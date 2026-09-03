import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import type { TokenPayload } from "./auth";

const JWT_SECRET = process.env.JWT_SECRET!;

// Server-component equivalent of requireRole() in lib/auth.ts (which reads
// from a NextRequest, only available in Route Handlers). Pages use
// next/headers' cookies() instead -- same JWT, same secret, different
// read mechanism because pages and Route Handlers get cookies differently.
export async function getSessionUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
