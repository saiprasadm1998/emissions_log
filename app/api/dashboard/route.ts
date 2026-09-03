import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";

// FR-09. Kept as a real API route (not just server-component-only) so a
// client component (or an external consumer) can also fetch this data --
// e.g. a period-selector that updates without a full page reload.
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const data = await getDashboardData(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);

  return Response.json(data);
}
