import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import db from "@/lib/db";

// FR-01: register view, all 3 roles can view. status column lets the UI
// visually distinguish decommissioned sources -- that's a display concern,
// not something this route needs to filter.
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const { rows } = await db.query(
    `SELECT source_code, source_name, source_type, process_unit, area, status
     FROM emission_sources
     ORDER BY source_code`
  );

  return Response.json(rows);
}
