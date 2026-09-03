import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { validateEvent } from "@/lib/validation";
import { createEventSchema, validationErrorResponse } from "@/lib/schemas";
import db from "@/lib/db";

function toPeriodMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function isPeriodClosed(periodMonth: string): Promise<boolean> {
  const { rows } = await db.query("SELECT 1 FROM month_closures WHERE period_month = $1", [periodMonth]);
  return rows.length > 0;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Gate 1: role check -- same roles as create (FR-04: "create or amend").
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER"]);
  if (!auth.ok) return auth.response;

  const rawBody = await req.json();
  // Reuse the same schema as create -- an amendment supplies the full
  // event shape, not a partial patch, since VR-01..04 need to be
  // re-evaluated against the complete post-amendment record anyway.
  const parsed = createEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }
  const { event_ref, source_code, start_datetime, end_datetime, reported_volume, volume_unit, cause, remarks } =
    parsed.data;

  // Fetch the existing row -- needed for (a) its current period, to check
  // alongside the new period, and (b) to 404 if it doesn't exist.
  const { rows: existingRows } = await db.query(
    "SELECT start_datetime FROM emission_events WHERE id = $1",
    [id]
  );
  if (existingRows.length === 0) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Gate 2: period-closed check on BOTH the event's current period and
  // the period it would move to -- prevents editing a record OUT of a
  // closed month, and editing a record INTO one, from either direction.
  const currentPeriod = toPeriodMonth(new Date(existingRows[0].start_datetime));
  const newPeriod = toPeriodMonth(new Date(start_datetime));

  if (await isPeriodClosed(currentPeriod)) {
    return Response.json({ error: `Cannot amend: current period ${currentPeriod} is closed` }, { status: 409 });
  }
  if (await isPeriodClosed(newPeriod)) {
    return Response.json({ error: `Cannot amend: target period ${newPeriod} is closed` }, { status: 409 });
  }

  // Re-run VR-01 to VR-04 against the full post-amendment record --
  // an amendment can turn a previously-accepted event into a rejected
  // one (e.g. editing the volume to blank) or vice versa.
  const { rows: dupRows } = await db.query(
    "SELECT COUNT(*) FROM emission_events WHERE event_ref = $1 AND id != $2",
    [event_ref, id]
  );
  const refCounts = { [event_ref]: parseInt(dupRows[0].count) + 1 };

  const { rows: sourceRows } = await db.query(
    "SELECT status FROM emission_sources WHERE source_code = $1",
    [source_code]
  );
  const sourceStatus = { [source_code]: sourceRows[0]?.status ?? "UNKNOWN" };

  const reasons = validateEvent(
    { event_ref, source_code, start_datetime, end_datetime, reported_volume },
    { refCounts, sourceStatus }
  );

  const { rows } = await db.query(
    `UPDATE emission_events SET
       event_ref = $1, source_code = $2, start_datetime = $3, end_datetime = $4,
       reported_volume = $5, volume_unit = $6, cause = $7, remarks = $8,
       is_accepted = $9, rejection_reasons = $10
     WHERE id = $11
     RETURNING id, is_accepted, rejection_reasons`,
    [
      event_ref,
      source_code,
      start_datetime,
      end_datetime ?? null,
      reported_volume ?? null,
      volume_unit ?? null,
      cause ?? null,
      remarks ?? null,
      reasons.length === 0,
      reasons,
      id,
    ]
  );

  return Response.json(rows[0]);
}
