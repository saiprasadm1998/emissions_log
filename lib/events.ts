import db from "./db";

export interface EventRow {
  id: string;
  event_ref: string;
  source_code: string;
  start_datetime: string;
  end_datetime: string | null;
  reported_volume: string | null;
  volume_unit: string | null;
  cause: string | null;
  recorded_by: string | null;
  remarks: string | null;
  is_accepted: boolean;
  rejection_reasons: string[];
  is_voided: boolean;
  void_reason: string | null;
}

// Shared by app/api/events/route.ts (GET) and app/register/page.tsx --
// same reasoning as lib/dashboard.ts: the page is server-side code with
// direct DB access, no need to fetch its own API.
export async function getEvents(filters: {
  sourceCode?: string;
  from?: string;
  to?: string;
  status?: "accepted" | "rejected" | "voided";
}): Promise<EventRow[]> {
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.sourceCode) {
    values.push(filters.sourceCode);
    conditions.push(`source_code = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    conditions.push(`start_datetime >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    conditions.push(`start_datetime <= $${values.length}`);
  }
  // FR-12: exception register is this same query, filtered to rejected
  // records -- not a separate page or table.
  if (filters.status === "accepted") {
    conditions.push(`is_accepted = true AND is_voided = false`);
  } else if (filters.status === "rejected") {
    conditions.push(`is_accepted = false AND is_voided = false`);
  } else if (filters.status === "voided") {
    conditions.push(`is_voided = true`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await db.query(
    `SELECT id, event_ref, source_code, start_datetime, end_datetime,
            reported_volume, volume_unit, cause, recorded_by, remarks,
            is_accepted, rejection_reasons, is_voided, void_reason
     FROM emission_events
     ${whereClause}
     ORDER BY start_datetime DESC`,
    values
  );

  return rows;
}

export interface SourceRow {
  source_code: string;
  source_name: string;
  source_type: string;
  process_unit: string | null;
  area: string | null;
  status: string;
}

export async function getSources(): Promise<SourceRow[]> {
  const { rows } = await db.query(
    `SELECT source_code, source_name, source_type, process_unit, area, status
     FROM emission_sources
     ORDER BY source_code`
  );
  return rows;
}

export interface FactorRow {
  id: string;
  factor_code: string;
  stream: string;
  factor_value: string;
  factor_unit: string;
  valid_from: string;
  valid_to: string | null;
  basis: string | null;
}

// FR-02: grouped by stream -- ORDER BY (not GROUP BY) does the grouping
// for display, since every validity period must remain visible, not be
// collapsed into one row per stream.
export async function getFactors(): Promise<FactorRow[]> {
  const { rows } = await db.query(
    `SELECT id, factor_code, stream, factor_value, factor_unit, valid_from, valid_to, basis
     FROM emission_factors
     ORDER BY stream, factor_code, valid_from`
  );
  return rows;
}

export async function getEventById(id: string): Promise<EventRow | null> {
  const { rows } = await db.query(
    `SELECT id, event_ref, source_code, start_datetime, end_datetime,
            reported_volume, volume_unit, cause, recorded_by, remarks,
            is_accepted, rejection_reasons, is_voided, void_reason
     FROM emission_events WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export interface MonthClosureRow {
  period_month: string;
  closed_by: string | null;
  closed_at: string;
}

export async function getMonthClosures(): Promise<MonthClosureRow[]> {
  const { rows } = await db.query(
    `SELECT period_month, closed_by, closed_at FROM month_closures ORDER BY period_month DESC`
  );
  return rows;
}
