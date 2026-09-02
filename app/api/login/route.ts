import { NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { signToken } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return Response.json({ error: "username and password required" }, { status: 400 });
  }

  const { rows } = await db.query(
    "SELECT id, username, password_hash, role FROM users WHERE username = $1",
    [username]
  );
  const user = rows[0];

  // Same error for "no such user" and "wrong password" -- don't reveal
  // which one it was, that's an enumeration leak.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signToken({ userId: user.id, username: user.username, role: user.role });

  const response = Response.json({ username: user.username, role: user.role });
  response.headers.set(
    "Set-Cookie",
    `session=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict`
  );
  return response;
}
