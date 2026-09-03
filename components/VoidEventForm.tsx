"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoidEventForm({ eventId, eventRef }: { eventId: string; eventRef: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/events/${eventId}/void`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ void_reason: form.get("void_reason") }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? data.details?.[0]?.message ?? "Couldn't void that event.");
      setSubmitting(false);
      return;
    }

    router.push("/register");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      {error && (
        <div className="panel" style={{ padding: 10, borderColor: "var(--rejected)", background: "var(--rejected-dim)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rejected)" }}>{error}</p>
        </div>
      )}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Reason for voiding {eventRef}</span>
        <input name="void_reason" required autoFocus placeholder="e.g. duplicate entry, superseded by corrected record" />
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={submitting}
          style={{ background: "var(--rejected)", borderColor: "var(--rejected)", color: "#2a0f0d" }}
        >
          {submitting ? "Voiding\u2026" : "Void event"}
        </button>
        <button type="button" onClick={() => router.push("/register")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
