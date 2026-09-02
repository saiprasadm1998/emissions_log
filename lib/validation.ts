// VR-01 to VR-04, extracted so both scripts/seed.ts (bulk CSV import) and
// the live API route (single-event creation) enforce identical rules --
// one source of truth, not two copies that can drift apart.
export interface ValidatableEvent {
  event_ref: string;
  source_code: string;
  start_datetime: string | Date;
  end_datetime: string | Date | null;
  reported_volume: number | string | null;
}

export function validateEvent(
  ev: ValidatableEvent,
  context: {
    refCounts: Record<string, number>; // how many times this event_ref appears (bulk import) -- pass {[ev.event_ref]: 1} for a single live-created event with no prior duplicates
    sourceStatus: Record<string, string>; // source_code -> status
  }
): string[] {
  const reasons: string[] = [];

  const start = new Date(ev.start_datetime);
  const end = ev.end_datetime ? new Date(ev.end_datetime) : null;

  // VR-01
  if (!end || end <= start) {
    reasons.push("END_NOT_AFTER_START");
  }
  // VR-02
  if (ev.reported_volume === null || ev.reported_volume === "" || ev.reported_volume === undefined) {
    reasons.push("VOLUME_MISSING");
  }
  // VR-03
  if ((context.refCounts[ev.event_ref] ?? 0) > 1) {
    reasons.push("DUPLICATE_REF");
  }
  // VR-04
  if (context.sourceStatus[ev.source_code] !== "ACTIVE") {
    reasons.push("SOURCE_NOT_ACTIVE");
  }

  return reasons;
}
