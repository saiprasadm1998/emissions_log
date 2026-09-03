import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSourceSchema, validationErrorResponse } from "@/lib/schemas";
import db from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const auth = requireRole(req, ["APPROVER"]);
  if (!auth.ok) return auth.response;

  const rawBody = await req.json();
  // Partial update: reuse createSourceSchema but allow any subset of fields.
  const parsed = createSourceSchema.partial().safeParse(rawBody);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }
  const updates = parsed.data;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(updates)) {
    values.push(value);
    setClauses.push(`${key} = $${values.length}`);
  }
  values.push(code);

  const { rows } = await db.query(
    `UPDATE emission_sources SET ${setClauses.join(", ")} WHERE source_code = $${values.length}
     RETURNING source_code, source_name, source_type, process_unit, area, status`,
    values
  );

  if (rows.length === 0) {
    return Response.json({ error: "Source not found" }, { status: 404 });
  }

  return Response.json(rows[0]);
}
