export async function POST() {
  const response = Response.json({ ok: true });
  // Overwrite with an already-expired cookie -- the standard way to clear
  // an httpOnly cookie, since client JS can't delete it directly.
  response.headers.set("Set-Cookie", "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict");
  return response;
}
