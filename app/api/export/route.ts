import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import db from "@/lib/db";

// FR-14: export of monthly reporting figures, machine-readable, including
// the emission factor version applied to each line. That's
// event_co2e_segments (one row per month x factor-period slice), not
// emission_events -- segments are the "monthly reporting figures", and
// each one already carries a direct FK to the exact factor row used.
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const { rows } = await db.query(
    `SELECT
       s.period_month,
       e.event_ref,
       e.source_code,
       src.source_name,
       f.factor_code,
       f.factor_value,
       f.factor_unit,
       f.valid_from AS factor_valid_from,
       f.valid_to AS factor_valid_to,
       s.segment_volume_ksm3,
       s.co2e_tco2e
     FROM event_co2e_segments s
     JOIN emission_events e ON e.id = s.event_id
     JOIN emission_sources src ON src.source_code = e.source_code
     JOIN emission_factors f ON f.id = s.factor_id
     ORDER BY s.period_month, e.source_code, e.event_ref`
  );

  const header = [
    "period_month",
    "event_ref",
    "source_code",
    "source_name",
    "factor_code",
    "factor_value",
    "factor_unit",
    "factor_valid_from",
    "factor_valid_to",
    "segment_volume_ksm3",
    "co2e_tco2e",
  ];

  // CSV, minimal manual escaping (wrap in quotes, double up embedded
  // quotes) -- no library needed for output this simple and fully
  // server-controlled (no untrusted free text fields in this dataset).
  const csvEscape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = val instanceof Date ? val.toISOString() : String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  // period_month, factor_valid_from, factor_valid_to are DATE columns
  // semantically -- trim to YYYY-MM-DD instead of a full midnight
  // timestamp, which is what a plain Date -> toISOString() would produce.
  const dateOnlyCols = new Set(["period_month", "factor_valid_from", "factor_valid_to"]);
  const formatCell = (col: string, val: unknown): string => {
    if (dateOnlyCols.has(col) && val) return csvEscape(new Date(val as string).toISOString().slice(0, 10));
    return csvEscape(val);
  };

  const lines = [
    header.join(","),
    ...rows.map((row) => header.map((col) => formatCell(col, row[col])).join(",")),
  ];

  const csv = lines.join("\n");
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="emissions-export-${today}.csv"`,
    },
  });
}
