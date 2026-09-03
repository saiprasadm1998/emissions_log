import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { closeMonthSchema, validationErrorResponse } from "@/lib/schemas";
import db from "@/lib/db";

// FR-07/FR-08: closing is Approver only. There is deliberately no PATCH/
// DELETE route on this resource -- reopening a closed month is Denied for
// every role in Section 8, so that capability simply isn't exposed
// anywhere in the API (see docs/API_DESIGN.md).
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ["APPROVER"]);
  if (!auth.ok) return auth.response;

  const rawBody = await req.json();
  const parsed = closeMonthSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }
  const { period_month } = parsed.data;

  try {
    const { rows } = await db.query(
      `INSERT INTO month_closures (period_month, closed_by) VALUES ($1, $2)
       RETURNING period_month, closed_by, closed_at`,
      [period_month, auth.user.userId]
    );
    return Response.json(rows[0], { status: 201 });
  } catch (err: any) {
    if (err.code === "23505") {
      return Response.json({ error: `Period ${period_month} is already closed` }, { status: 409 });
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DATA_ENTRY", "APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const { rows } = await db.query(
    `SELECT period_month, closed_by, closed_at FROM month_closures ORDER BY period_month DESC`
  );
  return Response.json(rows);
}
