import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Flare and Vent Emissions Log",
  description: "LA-ASM-WEB-001 flare and vent emissions log",
};

// Server component -- reads the session server-side and passes it down as
// plain props to the client Nav (which only needs client JS for the
// active-link highlighting and the sign-out click handler).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body>
        <Nav username={user?.username ?? null} role={user?.role ?? null} />
        <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px" }}>{children}</main>
      </body>
    </html>
  );
}
