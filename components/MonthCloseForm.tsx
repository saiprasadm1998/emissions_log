"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MonthCloseForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const monthInput = form.get("period_month") as string; // "2025-06"
    const period_month = `${monthInput}-01`;

    const res = await fetch("/api/month-closures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period_month }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't close that period.");
      setSubmitting(false);
      return;
    }

    router.refresh();
    setSubmitting(false);
    (document.getElementById("month-close-form") as HTMLFormElement)?.reset();
  }

  return (
    <form id="month-close-form" onSubmit={handleSubmit} className="panel" style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-end" }}>
      {error && (
        <div className="panel" style={{ padding: 8, borderColor: "var(--rejected)", background: "var(--rejected-dim)", flex: "0 0 100%" }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--rejected)" }}>{error}</p>
        </div>
      )}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Month to close</span>
        <input type="month" name="period_month" required />
      </label>
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? "Closing\u2026" : "Close month"}
      </button>
    </form>
  );
}
