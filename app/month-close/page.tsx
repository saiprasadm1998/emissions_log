import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getMonthClosures } from "@/lib/events";
import MonthCloseForm from "@/components/MonthCloseForm";

export const dynamic = "force-dynamic";

function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// FR-07: closing a month is Approver only (Section 8). FR-08: no reopen
// interface exists anywhere -- see docs/API_DESIGN.md for why that's a
// deliberate absence, not an oversight.
export default async function MonthClosePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.role !== "APPROVER") {
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Your role ({user.role}) doesn&apos;t have permission to close a calendar month.
        </p>
      </div>
    );
  }

  const closures = await getMonthClosures();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Close a calendar month</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        Once closed, no event in that month can be created, amended or voided through any interface. This cannot be
        undone here — see the assumptions log for the controlled procedure to reopen a month if operationally necessary.
      </p>

      <MonthCloseForm />

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <p className="panel-title" style={{ padding: "12px 16px 0" }}>
          Closed months
        </p>
        {closures.length === 0 ? (
          <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>No months closed yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Closed at</th>
              </tr>
            </thead>
            <tbody>
              {closures.map((c) => (
                <tr key={c.period_month}>
                  <td>{fmtMonth(c.period_month)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {new Date(c.closed_at).toLocaleString("en-GB", { timeZone: "UTC" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
