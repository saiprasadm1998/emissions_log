import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import db from "@/lib/db";

// FR-02: factor register grouped by stream, showing every validity
// period. ORDER BY does the "grouping" for display purposes -- the UI
// renders consecutive same-stream rows together; an actual SQL GROUP BY
// would collapse rows, which isn't wanted here (every version must show).
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const { rows } = await db.query(
    `SELECT id, factor_code, stream, factor_value, factor_unit, valid_from, valid_to, basis
     FROM emission_factors
     ORDER BY stream, factor_code, valid_from`
  );

  return Response.json(rows);
}
