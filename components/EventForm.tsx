"use client";
// Client component: needs useState for form field values and submission
// state, and an onSubmit handler -- neither is available in a server
// component. This is one of the few genuinely interactive pieces of the
// app (see docs/ASSUMPTIONS.md / README's TC-01 justification).
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SourceRow, EventRow } from "@/lib/events";

interface FieldError {
  field: string;
  message: string;
}

// toLocalInputValue: converts a stored UTC ISO string into the format
// <input type="datetime-local"> expects (no timezone suffix, local to
// however the browser renders it) -- needed to pre-fill the edit form.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export default function EventForm({ sources, existingEvent }: { sources: SourceRow[]; existingEvent?: EventRow }) {
  const router = useRouter();
  const isEdit = Boolean(existingEvent);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<{ is_accepted: boolean; rejection_reasons: string[] } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors([]);
    setServerError(null);
    setResult(null);

    const form = new FormData(e.currentTarget);
    const body = {
      event_ref: form.get("event_ref"),
      source_code: form.get("source_code"),
      start_datetime: form.get("start_datetime") ? new Date(form.get("start_datetime") as string).toISOString() : null,
      end_datetime: form.get("end_datetime") ? new Date(form.get("end_datetime") as string).toISOString() : null,
      reported_volume: form.get("reported_volume") ? Number(form.get("reported_volume")) : null,
      volume_unit: form.get("volume_unit") || null,
      cause: form.get("cause") || null,
      remarks: form.get("remarks") || null,
    };

    try {
      const res = await fetch(isEdit ? `/api/events/${existingEvent!.id}` : "/api/events", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 400 && data.details) {
        setFieldErrors(data.details);
      } else if (!res.ok) {
        setServerError(data.error ?? "Something went wrong. Try again.");
      } else if (isEdit) {
        // Amendment saved -- go back to the register to see it reflected.
        router.push("/register");
        router.refresh();
      } else {
        setResult({ is_accepted: data.is_accepted, rejection_reasons: data.rejection_reasons });
        (e.target as HTMLFormElement).reset();
      }
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function errorFor(field: string): string | undefined {
    return fieldErrors.find((f) => f.field === field)?.message;
  }

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      {result && (
        <div
          className="panel"
          style={{
            padding: 12,
            borderColor: result.is_accepted ? "var(--accepted)" : "var(--rejected)",
            background: result.is_accepted ? "var(--accepted-dim)" : "var(--rejected-dim)",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: result.is_accepted ? "var(--accepted)" : "var(--rejected)" }}>
            {result.is_accepted
              ? "Event recorded and accepted."
              : `Event recorded but rejected: ${result.rejection_reasons.join(", ")}`}
          </p>
        </div>
      )}
      {serverError && (
        <div className="panel" style={{ padding: 12, borderColor: "var(--rejected)", background: "var(--rejected-dim)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rejected)" }}>{serverError}</p>
        </div>
      )}

      <Field label="Event reference" error={errorFor("event_ref")}>
        <input name="event_ref" required placeholder="FVE-00136" defaultValue={existingEvent?.event_ref} />
      </Field>

      <Field label="Source" error={errorFor("source_code")}>
        <select name="source_code" required defaultValue={existingEvent?.source_code ?? ""}>
          <option value="" disabled>
            Select a source
          </option>
          {sources.map((s) => (
            <option key={s.source_code} value={s.source_code}>
              {s.source_code} — {s.source_name}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Start" error={errorFor("start_datetime")}>
          <input type="datetime-local" name="start_datetime" required defaultValue={toLocalInputValue(existingEvent?.start_datetime ?? null)} />
        </Field>
        <Field label="End" error={errorFor("end_datetime")}>
          <input type="datetime-local" name="end_datetime" defaultValue={toLocalInputValue(existingEvent?.end_datetime ?? null)} />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Field label="Reported volume" error={errorFor("reported_volume")}>
          <input type="number" step="any" name="reported_volume" placeholder="50.000" defaultValue={existingEvent?.reported_volume ?? ""} />
        </Field>
        <Field label="Unit" error={errorFor("volume_unit")}>
          <select name="volume_unit" defaultValue={existingEvent?.volume_unit ?? "kSm3"}>
            <option value="kSm3">kSm3</option>
            <option value="Sm3">Sm3</option>
          </select>
        </Field>
      </div>

      <Field label="Cause">
        <input name="cause" placeholder="Compressor trip" defaultValue={existingEvent?.cause ?? ""} />
      </Field>

      <Field label="Remarks">
        <input name="remarks" placeholder="Optional" defaultValue={existingEvent?.remarks ?? ""} />
      </Field>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? "Saving\u2026" : isEdit ? "Save changes" : "Save event"}
        </button>
        <button type="button" onClick={() => router.push("/register")}>
          {isEdit ? "Cancel" : "View register"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: "var(--rejected)" }}>{error}</span>}
    </label>
  );
}
