import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import db from "@/lib/db";

// FR-09: total CO2e for a selected period, flared/vented split, monthly
// trend across the full range, and a ranked source breakdown. All four
// aggregations run in SQL (TC-05) -- never pulled into JS and summed here.
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // period_month lower bound, e.g. 2024-01-01
  const to = searchParams.get("to");

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

  // 1. Total CO2e for the selected period.
  const totalResult = await db.query(
    `SELECT COALESCE(SUM(co2e_tco2e), 0) AS total FROM event_co2e_segments ${periodWhere}`,
    periodValues
  );

  // 2. Flared vs vented split (period-filtered).
  const splitResult = await db.query(
    `SELECT es.source_type, COALESCE(SUM(s.co2e_tco2e), 0) AS total
     FROM event_co2e_segments s
     JOIN emission_events e ON e.id = s.event_id
     JOIN emission_sources es ON es.source_code = e.source_code
     ${periodWhere.replace(/period_month/g, "s.period_month")}
     GROUP BY es.source_type`,
    periodValues
  );

  // 3. Monthly trend across the FULL data range (deliberately not
  // period-filtered -- FR-09 asks for the full range here, unlike 1/2/4).
  const trendResult = await db.query(
    `SELECT period_month, COALESCE(SUM(co2e_tco2e), 0) AS total
     FROM event_co2e_segments
     GROUP BY period_month
     ORDER BY period_month`
  );

  // 4. Ranked breakdown by source (period-filtered).
  const bySourceResult = await db.query(
    `SELECT e.source_code, es.source_name, COALESCE(SUM(s.co2e_tco2e), 0) AS total
     FROM event_co2e_segments s
     JOIN emission_events e ON e.id = s.event_id
     JOIN emission_sources es ON es.source_code = e.source_code
     ${periodWhere.replace(/period_month/g, "s.period_month")}
     GROUP BY e.source_code, es.source_name
     ORDER BY total DESC`,
    periodValues
  );

  return Response.json({
    total_co2e: totalResult.rows[0].total,
    flared_vs_vented: splitResult.rows,
    monthly_trend: trendResult.rows,
    by_source: bySourceResult.rows,
  });
}
