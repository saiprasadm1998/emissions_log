"use client";
// Client component: form input state, submission, and a client-side
// redirect after success all need browser-side interactivity.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Sign in failed.");
      setSubmitting(false);
      return;
    }

    // Full navigation (not client-side router.push) so the server
    // components on the next page re-read the freshly-set cookie.
    window.location.href = "/";
  }

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      {error && (
        <div className="panel" style={{ padding: 10, borderColor: "var(--rejected)", background: "var(--rejected-dim)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rejected)" }}>{error}</p>
        </div>
      )}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Username</span>
        <input name="username" required autoFocus />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Password</span>
        <input name="password" type="password" required />
      </label>
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? "Signing in\u2026" : "Sign in"}
      </button>
    </form>
  );
}
