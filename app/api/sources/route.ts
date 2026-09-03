import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSourceSchema, validationErrorResponse } from "@/lib/schemas";
import { getSources } from "@/lib/events";
import db from "@/lib/db";

// FR-01: register view, all 3 roles can view. status column lets the UI
// visually distinguish decommissioned sources -- that's a display concern,
// not something this route needs to filter.
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const rows = await getSources();
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  // Approver only (Section 8: "Maintain the emission source register").
  const auth = requireRole(req, ["APPROVER"]);
  if (!auth.ok) return auth.response;

  const rawBody = await req.json();
  const parsed = createSourceSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }
  const { source_code, source_name, source_type, process_unit, area, status } = parsed.data;

  try {
    const { rows } = await db.query(
      `INSERT INTO emission_sources (source_code, source_name, source_type, process_unit, area, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING source_code`,
      [source_code, source_name, source_type, process_unit ?? null, area ?? null, status]
    );
    return Response.json(rows[0], { status: 201 });
  } catch (err: any) {
    if (err.code === "23505") {
      return Response.json({ error: `source_code ${source_code} already exists` }, { status: 409 });
    }
    throw err;
  }
}
