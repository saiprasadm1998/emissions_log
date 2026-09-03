// Shared by app/api/dashboard/route.ts (client-facing JSON API) and
// app/page.tsx (server component -- calls this directly, no self-fetch;
// see docs/ASSUMPTIONS.md for why: the page is already server-side code
// with direct DB access, so an HTTP round-trip to its own API would be
// pure overhead).
import db from "./db";

export interface DashboardData {
  total_co2e: string;
  flared_vs_vented: { source_type: string; total: string }[];
  monthly_trend: { period_month: string; total: string }[];
  by_source: { source_code: string; source_name: string; source_type: string; total: string }[];
}

export async function getDashboardData(from?: string, to?: string): Promise<DashboardData> {
  const periodConditions: string[] = [];
  const periodValues: string[] = [];
  if (from) {
    periodValues.push(from);
    periodConditions.push(`period_month >= $${periodValues.length}`);
  }
  if (to) {
    periodValues.push(to);
    periodConditions.push(`period_month <= $${periodValues.length}`);
  }
  const periodWhere = periodConditions.length > 0 ? `WHERE ${periodConditions.join(" AND ")}` : "";

  const totalResult = await db.query(
    `SELECT COALESCE(SUM(co2e_tco2e), 0) AS total FROM event_co2e_segments ${periodWhere}`,
    periodValues
  );

  const splitResult = await db.query(
    `SELECT es.source_type, COALESCE(SUM(s.co2e_tco2e), 0) AS total
     FROM event_co2e_segments s
     JOIN emission_events e ON e.id = s.event_id
     JOIN emission_sources es ON es.source_code = e.source_code
     ${periodWhere.replace(/period_month/g, "s.period_month")}
     GROUP BY es.source_type`,
    periodValues
  );

  const trendResult = await db.query(
    `SELECT period_month, COALESCE(SUM(co2e_tco2e), 0) AS total
     FROM event_co2e_segments
     GROUP BY period_month
     ORDER BY period_month`
  );

  const bySourceResult = await db.query(
    `SELECT e.source_code, es.source_name, es.source_type, COALESCE(SUM(s.co2e_tco2e), 0) AS total
     FROM event_co2e_segments s
     JOIN emission_events e ON e.id = s.event_id
     JOIN emission_sources es ON es.source_code = e.source_code
     ${periodWhere.replace(/period_month/g, "s.period_month")}
     GROUP BY e.source_code, es.source_name, es.source_type
     ORDER BY total DESC`,
    periodValues
  );

  return {
    total_co2e: totalResult.rows[0].total,
    flared_vs_vented: splitResult.rows,
    monthly_trend: trendResult.rows,
    by_source: bySourceResult.rows,
  };
}
