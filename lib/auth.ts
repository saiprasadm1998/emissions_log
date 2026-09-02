// Auth helpers used by every API route. requireRole() is the equivalent
// of "middleware" mentioned in chat -- in Next.js App Router, each Route
// Handler calls this itself at the top, rather than a separate global
// middleware file, so the auth check is explicit and visible in every
// route (easier to verify per-route in a live review than a hidden
// global config).
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in .env");
}

export type Role = "DATA_ENTRY" | "APPROVER" | "AUDITOR";

export interface TokenPayload {
  userId: string;
  username: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

// Returns the decoded token if valid, or null if missing/invalid/expired.
function getTokenFromRequest(req: NextRequest): TokenPayload | null {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null; // covers expired tokens, tampered signatures, garbage input
  }
}

// Call this at the top of every protected route handler.
// Returns the authenticated user's payload if allowed, or a Response to
// return immediately (401/403) if not -- the caller checks which one it got.
export function requireRole(
  req: NextRequest,
  allowedRoles: Role[]
): { ok: true; user: TokenPayload } | { ok: false; response: Response } {
  const user = getTokenFromRequest(req);

  if (!user) {
    return { ok: false, response: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  if (!allowedRoles.includes(user.role)) {
    return { ok: false, response: Response.json({ error: "Forbidden for this role" }, { status: 403 }) };
  }

  return { ok: true, user };
}
