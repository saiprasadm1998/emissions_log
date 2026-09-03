import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { voidEventSchema, validationErrorResponse } from "@/lib/schemas";
import db from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Gate 1: Approver only (Section 8).
  const auth = requireRole(req, ["APPROVER"]);
  if (!auth.ok) return auth.response;

  const rawBody = await req.json();
  const parsed = voidEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }
  const { void_reason } = parsed.data;

  const { rows: existing } = await db.query("SELECT id FROM emission_events WHERE id = $1", [id]);
  if (existing.length === 0) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Void does not touch source_code/dates/volume, so VR-01..04 don't need
  // re-running -- it only flags the record and clears its calculated
  // segments so it stops contributing to totals (same "delete and rebuild"
  // pattern as an amendment or factor supersession -- a voided event's
  // segments would otherwise silently linger and still count).
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE emission_events SET is_voided = true, void_reason = $1 WHERE id = $2",
      [void_reason, id]
    );
    await client.query("DELETE FROM event_co2e_segments WHERE event_id = $1", [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return Response.json({ id, is_voided: true, void_reason });
}
