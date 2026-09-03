"use client";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/register", label: "Register" },
  { href: "/register?status=rejected", label: "Exceptions" },
  { href: "/sources", label: "Sources" },
  { href: "/factors", label: "Factors" },
  { href: "/register/new", label: "New entry" },
];

const approverLinks = [{ href: "/month-close", label: "Close month" }];

export default function Nav({ username, role }: { username: string | null; role: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <nav
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          height: 52,
          gap: 4,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: "var(--text)",
            marginRight: 20,
            whiteSpace: "nowrap",
          }}
        >
          Flare &amp; Vent Log
        </span>
        {username &&
          [...links, ...(role === "APPROVER" ? approverLinks : [])].map((link) => {
            const active = currentUrl === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: active ? "var(--text)" : "var(--text-muted)",
                  background: active ? "var(--surface-raised)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {username ? (
            <>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {username}{" "}
                <span className="badge" style={{ background: "var(--surface-raised)", color: "var(--text-muted)", marginLeft: 4 }}>
                  {role}
                </span>
              </span>
              <button onClick={handleLogout} style={{ padding: "5px 12px", fontSize: 12 }}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" style={{ fontSize: 12, color: "var(--vent)" }}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
