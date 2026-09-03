"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FactorRow } from "@/lib/events";

interface FieldError {
  field: string;
  message: string;
}

export default function SupersedeFactorForm({ openFactors }: { openFactors: FactorRow[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState("");

  const currentRow = openFactors.find((f) => f.factor_code === selectedCode);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors([]);
    setServerError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);
    const body = {
      factor_code: form.get("factor_code"),
      factor_value: Number(form.get("factor_value")),
      factor_unit: form.get("factor_unit"),
      valid_from: form.get("valid_from"),
      basis: form.get("basis") || null,
    };

    try {
      const res = await fetch("/api/factors/supersede", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 400 && data.details) {
        setFieldErrors(data.details);
      } else if (!res.ok) {
        setServerError(data.error ?? "Couldn't supersede that factor.");
      } else {
        setSuccess(`Superseded. New validity period starts ${data.valid_from}.`);
        (e.target as HTMLFormElement).reset();
        setSelectedCode("");
        router.refresh();
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
      {success && (
        <div className="panel" style={{ padding: 12, borderColor: "var(--accepted)", background: "var(--accepted-dim)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--accepted)" }}>{success}</p>
        </div>
      )}
      {serverError && (
        <div className="panel" style={{ padding: 12, borderColor: "var(--rejected)", background: "var(--rejected-dim)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rejected)" }}>{serverError}</p>
        </div>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Factor stream</span>
        <select
          name="factor_code"
          required
          value={selectedCode}
          onChange={(e) => setSelectedCode(e.target.value)}
        >
          <option value="" disabled>
            Select a stream
          </option>
          {openFactors.map((f) => (
            <option key={f.factor_code} value={f.factor_code}>
              {f.stream} ({f.factor_code})
            </option>
          ))}
        </select>
        {errorFor("factor_code") && <span style={{ fontSize: 11, color: "var(--rejected)" }}>{errorFor("factor_code")}</span>}
      </label>

      {currentRow && (
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
          Currently: <span className="mono">{currentRow.factor_value}</span> {currentRow.factor_unit}, in force since{" "}
          {new Date(currentRow.valid_from).toLocaleDateString("en-GB", { timeZone: "UTC" })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>New value</span>
          <input type="number" step="any" name="factor_value" required />
          {errorFor("factor_value") && <span style={{ fontSize: 11, color: "var(--rejected)" }}>{errorFor("factor_value")}</span>}
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Unit</span>
          <input name="factor_unit" required defaultValue="tCO2e/kSm3" />
        </label>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>New validity starts</span>
        <input type="date" name="valid_from" required />
        {errorFor("valid_from") && <span style={{ fontSize: 11, color: "var(--rejected)" }}>{errorFor("valid_from")}</span>}
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Basis</span>
        <input name="basis" placeholder="e.g. updated composition survey" />
      </label>

      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? "Superseding\u2026" : "Supersede"}
      </button>
    </form>
  );
}
