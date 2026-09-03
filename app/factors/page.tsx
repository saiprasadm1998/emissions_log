import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getFactors } from "@/lib/events";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "Open";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

// FR-02: grouped by stream, every validity period visible (superseded
// versions are never hidden -- shown with an explicit "Superseded" badge
// instead, using valid_to IS NOT NULL as the signal).
export default async function FactorsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let factors;
  try {
    factors = await getFactors();
  } catch {
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Couldn&apos;t load the factor register. The database may be unreachable.
        </p>
      </div>
    );
  }

  if (factors.length === 0) {
    return (
      <div className="panel" style={{ padding: 24 }}>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>No emission factors registered yet.</p>
      </div>
    );
  }

  // Group for display -- rows are already ordered by stream from the
  // query, this just clusters them into sections.
  const byStream = new Map<string, typeof factors>();
  for (const f of factors) {
    if (!byStream.has(f.stream)) byStream.set(f.stream, []);
    byStream.get(f.stream)!.push(f);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Emission factor register</h1>

      {Array.from(byStream.entries()).map(([stream, rows]) => (
        <div key={stream} className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{stream}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 8 }}>
              {rows[0].factor_code}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Valid from</th>
                <th>Valid to</th>
                <th style={{ textAlign: "right" }}>Value</th>
                <th>Unit</th>
                <th>Basis</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtDate(f.valid_from)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtDate(f.valid_to)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{f.factor_value}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{f.factor_unit}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 280 }}>{f.basis ?? "\u2014"}</td>
                  <td>
                    {f.valid_to === null ? (
                      <span className="badge badge-accepted">In force</span>
                    ) : (
                      <span className="badge badge-voided">Superseded</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
