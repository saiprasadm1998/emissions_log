import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { supersedeFactorSchema, validationErrorResponse } from "@/lib/schemas";
import db from "@/lib/db";

// FR-11 / Section 4: supersession never edits an existing row -- it closes
// the current open period's valid_to (to the day before the new
// valid_from) and inserts a new row. Both happen in one transaction so a
// crash between the two steps can't leave the stream with either two open
// rows or zero open rows.
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ["APPROVER"]);
  if (!auth.ok) return auth.response;

  const rawBody = await req.json();
  const parsed = supersedeFactorSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }
  const { factor_code, factor_value, factor_unit, valid_from, basis } = parsed.data;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Find the currently open row for this stream, lock it against
    // concurrent supersession attempts.
    const { rows: openRows } = await client.query(
      `SELECT id, valid_from FROM emission_factors
       WHERE factor_code = $1 AND valid_to IS NULL
       FOR UPDATE`,
      [factor_code]
    );

    if (openRows.length === 0) {
      await client.query("ROLLBACK");
      return Response.json(
        { error: `No currently open validity period found for factor_code ${factor_code}` },
        { status: 404 }
      );
    }

    // A new valid_from that isn't strictly after the currently open row's
    // own valid_from would make that row's valid_to < valid_from once
    // closed -- a nonsensical range. Caught explicitly here with a clean
    // error, rather than letting Postgres reject it with a raw range-type
    // error (verified during testing: attempting to supersede with an
    // earlier date produced exactly this).
    if (new Date(valid_from) <= new Date(openRows[0].valid_from)) {
      await client.query("ROLLBACK");
      return Response.json(
        {
          error: `New valid_from (${valid_from}) must be after the currently open period's start (${openRows[0].valid_from})`,
        },
        { status: 409 }
      );
    }

    // Close it the day before the new period starts.
    const newValidTo = new Date(valid_from);
    newValidTo.setUTCDate(newValidTo.getUTCDate() - 1);
    const closeDate = newValidTo.toISOString().slice(0, 10);

    await client.query(
      "UPDATE emission_factors SET valid_to = $1 WHERE id = $2",
      [closeDate, openRows[0].id]
    );

    // Insert the new open-ended row. If valid_from isn't actually after
    // the closed row's valid_from (e.g. a bad date), the EXCLUDE
    // constraint on (factor_code, daterange) rejects this at the database
    // level -- that's the DB-level guarantee doing its job, not something
    // this route needs to re-check itself.
    const { rows: newRows } = await client.query(
      `INSERT INTO emission_factors (factor_code, stream, factor_value, factor_unit, valid_from, valid_to, basis)
       SELECT factor_code, stream, $1, $2, $3, NULL, $4
       FROM emission_factors WHERE id = $5
       RETURNING id, factor_code, valid_from, valid_to, factor_value`,
      [factor_value, factor_unit, valid_from, basis ?? null, openRows[0].id]
    );

  

    await client.query("COMMIT");
    return Response.json(newRows[0], { status: 201 });
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23P01") {
      // exclusion_violation -- the EXCLUDE constraint caught an overlap.
      return Response.json(
        { error: "New validity period would overlap an existing one for this stream" },
        { status: 409 }
      );
    }
    throw err;
  } finally {
    client.release();
  }
}
