import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { validateEvent } from "@/lib/validation";
import { createEventSchema, validationErrorResponse } from "@/lib/schemas";
import db from "@/lib/db";

// FR-03: server-side filtering by source and date range -- filtering
// happens in the SQL WHERE clause, not by fetching everything and
// filtering in JS (same principle as TC-05's aggregation rule).
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const sourceCode = searchParams.get("source_code");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  const conditions: string[] = [];
  const values: string[] = [];

  if (sourceCode) {
    values.push(sourceCode);
    conditions.push(`source_code = $${values.length}`);
  }
  if (fromDate) {
    values.push(fromDate);
    conditions.push(`start_datetime >= $${values.length}`);
  }
  if (toDate) {
    values.push(toDate);
    conditions.push(`start_datetime <= $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Parameterised throughout (NFR-02) -- filter values are never
  // string-concatenated into the query, they're always $1/$2/$3 placeholders.
  const { rows } = await db.query(
    `SELECT id, event_ref, source_code, start_datetime, end_datetime,
            reported_volume, volume_unit, cause, recorded_by, remarks,
            is_accepted, rejection_reasons, is_voided, void_reason
     FROM emission_events
     ${whereClause}
     ORDER BY start_datetime DESC`,
    values
  );

  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  // Gate 1: role check.
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER"]);
  if (!auth.ok) return auth.response;

  const rawBody = await req.json();
  const parsed = createEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }
  const { event_ref, source_code, start_datetime, end_datetime, reported_volume, volume_unit, cause, remarks } =
    parsed.data;

  // Gate 2: period-closed check. An event's period is determined by its
  // start_datetime's calendar month (UTC -- see docs/ASSUMPTIONS.md).
  const eventMonth = new Date(start_datetime);
  const periodMonth = `${eventMonth.getUTCFullYear()}-${String(eventMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const { rows: closedRows } = await db.query(
    "SELECT 1 FROM month_closures WHERE period_month = $1",
    [periodMonth]
  );
  if (closedRows.length > 0) {
    return Response.json({ error: `Period ${periodMonth} is closed` }, { status: 409 });
  }

  // Validation (VR-01 to VR-04) -- same shared logic as the bulk seed script.
  const { rows: dupRows } = await db.query(
    "SELECT COUNT(*) FROM emission_events WHERE event_ref = $1",
    [event_ref]
  );
  // +1 accounts for the row we're about to insert -- if one already
  // exists, this new one plus the existing one both count as duplicates.
  const refCounts = { [event_ref]: parseInt(dupRows[0].count) + 1 };

  const { rows: sourceRows } = await db.query(
    "SELECT status FROM emission_sources WHERE source_code = $1",
    [source_code]
  );
  const sourceStatus = { [source_code]: sourceRows[0]?.status ?? "UNKNOWN" };

  const reasons = validateEvent(
    { event_ref, source_code, start_datetime, end_datetime: end_datetime ?? null, reported_volume: reported_volume ?? null },
    { refCounts, sourceStatus }
  );

  const { rows } = await db.query(
    `INSERT INTO emission_events
      (event_ref, source_code, start_datetime, end_datetime, reported_volume, volume_unit, cause, recorded_by, remarks, is_accepted, rejection_reasons)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, is_accepted, rejection_reasons`,
    [
      event_ref,
      source_code,
      start_datetime,
      end_datetime ?? null,
      reported_volume ?? null,
      volume_unit ?? null,
      cause ?? null,
      auth.user.username,
      remarks ?? null,
      reasons.length === 0,
      reasons,
    ]
  );

  return Response.json(rows[0], { status: 201 });
}
