import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getDashboardData } from "@/lib/dashboard";

// Server component: queries the database directly (see lib/dashboard.ts
// comment) -- no client JS needed to render this page at all.
export const dynamic = "force-dynamic"; // always reflect the latest data, not a stale build-time snapshot

function fmt(n: string | number): string {
  return Number(n).toLocaleString("en-GB", { maximumFractionDigits: 3 });
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

// Last calendar day of the month a given period_month value falls in --
// used to build a from/to pair that selects exactly that one month.
// period_month arrives from pg as a Date object (DATE column), not a
// string -- same underlying cause as the calc-engine valid_to bug found
// earlier, so both helpers here wrap with new Date() defensively.
function toDateStr(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function monthEnd(value: string | Date): string {
  const d = new Date(value);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;

  // All three roles can view the dashboard (Section 8) -- so this only
  // checks "is someone logged in", not a specific role.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let data;
  try {
    data = await getDashboardData(from, to);
  } catch (err) {
    // NFR-05: explicit error state, not an indefinite blank page.
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Couldn&apos;t load dashboard data. The database may be unreachable.
        </p>
      </div>
    );
  }

  const { total_co2e, flared_vs_vented, monthly_trend, by_source } = data;

  const periodForm = (
    <form method="GET" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input type="date" name="from" defaultValue={from?.slice(0, 10) ?? ""} aria-label="From date" />
      <span style={{ color: "var(--text-faint)", fontSize: 12 }}>→</span>
      <input type="date" name="to" defaultValue={to?.slice(0, 10) ?? ""} aria-label="To date" />
      <button type="submit" style={{ padding: "6px 12px", fontSize: 12 }}>
        Apply
      </button>
      {(from || to) && (
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Reset
        </Link>
      )}
    </form>
  );

  // NFR-05: explicit empty state.
  if (monthly_trend.length === 0) {
    return (
      <div className="panel" style={{ padding: 24 }}>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          No calculated emissions yet. Run the calculation engine after seeding event data.
        </p>
      </div>
    );
  }

  const flareTotal = Number(flared_vs_vented.find((f) => f.source_type === "FLARE")?.total ?? 0);
  const ventTotal = Number(flared_vs_vented.find((f) => f.source_type === "VENT")?.total ?? 0);
  const splitTotal = flareTotal + ventTotal;
  const flarePct = splitTotal > 0 ? (flareTotal / splitTotal) * 100 : 0;

  const maxMonthTotal = Math.max(...monthly_trend.map((m) => Number(m.total)));
  const maxSourceTotal = Math.max(...by_source.map((s) => Number(s.total)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Emissions dashboard</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {periodForm}
          <a href="/api/export" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "6px 12px" }}>
            Export CSV
          </a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        {/* Total CO2e -- instrument-readout treatment. */}
        <div className="panel" style={{ padding: 20 }}>
          <p className="panel-title">Total CO2e, selected period</p>
          <div className="mono" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1 }}>
            {fmt(total_co2e)}
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)", marginLeft: 8 }}>
              tCO2e
            </span>
          </div>
        </div>

        {/* Flared vs vented split. */}
        <div className="panel" style={{ padding: 20 }}>
          <p className="panel-title">Flared vs vented</p>
          <div
            style={{
              display: "flex",
              height: 10,
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div style={{ width: `${flarePct}%`, background: "var(--flare)" }} />
            <div style={{ width: `${100 - flarePct}%`, background: "var(--vent)" }} />
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <span className="badge badge-flare">Flared</span>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>
                {fmt(flareTotal)} <span style={{ fontSize: 12, color: "var(--text-faint)" }}>tCO2e</span>
              </div>
            </div>
            <div>
              <span className="badge badge-vent">Vented</span>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>
                {fmt(ventTotal)} <span style={{ fontSize: 12, color: "var(--text-faint)" }}>tCO2e</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly trend -- custom bar chart, no charting library. Each bar
          is a link that sets the period selector to that exact month, so
          the total/split/ranked panels above can drill into one month --
          the trend itself always stays full-range per FR-09's wording. */}
      <div className="panel" style={{ padding: 20 }}>
        <p className="panel-title">Monthly trend, full data range — click a month to filter above</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 180, paddingTop: 8 }}>
          {monthly_trend.map((m) => {
            const heightPct = maxMonthTotal > 0 ? (Number(m.total) / maxMonthTotal) * 100 : 0;
            const monthFrom = toDateStr(m.period_month);
            const monthTo = monthEnd(m.period_month);
            const isSelected = from === monthFrom && to === monthTo;
            return (
              <Link
                key={m.period_month}
                href={`/?from=${monthFrom}&to=${monthTo}`}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  height: "100%",
                  textDecoration: "none",
                  borderRadius: 4,
                  padding: "4px 2px 0",
                  background: isSelected ? "var(--surface-raised)" : "transparent",
                }}
              >
                <span className="mono" style={{ fontSize: 10, color: isSelected ? "var(--text)" : "var(--text-faint)" }}>
                  {fmt(m.total)}
                </span>
                {/* Fixed-pixel-height wrapper -- the bar's percentage height
                    needs a parent with a resolved (non-auto) height to
                    measure against, otherwise it collapses to 0. */}
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(heightPct, 3)}%`,
                      background: isSelected ? "var(--flare)" : "var(--vent)",
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: isSelected ? "var(--text)" : "var(--text-muted)", fontWeight: isSelected ? 600 : 400 }}>
                  {monthLabel(m.period_month)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Ranked by source. */}
      <div className="panel" style={{ padding: 20 }}>
        <p className="panel-title">Ranked by emission source</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {by_source.map((s) => {
            const widthPct = maxSourceTotal > 0 ? (Number(s.total) / maxSourceTotal) * 100 : 0;
            const color = s.source_type === "FLARE" ? "var(--flare)" : "var(--vent)";
            return (
              <div key={s.source_code} style={{ display: "grid", gridTemplateColumns: "140px 1fr 90px", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.source_name}
                </span>
                <div style={{ background: "var(--surface-raised)", borderRadius: 3, height: 16, overflow: "hidden" }}>
                  <div style={{ width: `${widthPct}%`, height: "100%", background: color }} />
                </div>
                <span className="mono" style={{ fontSize: 12, textAlign: "right" }}>
                  {fmt(s.total)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
