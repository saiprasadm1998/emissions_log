import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import db from "@/lib/db";

// Section 8: Approver and Auditor can view; Data Entry denied.
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["APPROVER", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  const { rows } = await db.query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.change_detail, a.created_at, u.username
     FROM audit_log a
     JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT 200`
  );
  return Response.json(rows);
}
