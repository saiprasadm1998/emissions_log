import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getEvents, getSources } from "@/lib/events";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function StatusBadge({ event }: { event: { is_accepted: boolean; is_voided: boolean; rejection_reasons: string[] } }) {
  if (event.is_voided) return <span className="badge badge-voided">Voided</span>;
  if (event.is_accepted) return <span className="badge badge-accepted">Accepted</span>;
  return <span className="badge badge-rejected">Rejected</span>;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ source_code?: string; from?: string; to?: string; status?: "accepted" | "rejected" | "voided" }>;
}) {
  const { source_code, from, to, status } = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const canAmend = user.role === "DATA_ENTRY" || user.role === "APPROVER";

  let events, sources;
  try {
    [events, sources] = await Promise.all([
      getEvents({ sourceCode: source_code, from, to, status }),
      getSources(),
    ]);
  } catch (err) {
    // NFR-05: explicit error state.
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Couldn&apos;t load the register. The database may be unreachable.
        </p>
      </div>
    );
  }

  const hasFilter = Boolean(source_code || from || to || status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Event register</h1>
        <Link href="/register/new">
          <button className="primary">New entry</button>
        </Link>
      </div>

      {/* FR-03: server-side filtering, via plain GET form -- no client JS
          needed; the server component reads the resulting searchParams
          and re-queries with the filter applied. */}
      <form method="GET" className="panel" style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
            Source
          </label>
          <select name="source_code" defaultValue={source_code ?? ""}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.source_code} value={s.source_code}>
                {s.source_code} — {s.source_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
            From
          </label>
          <input type="date" name="from" defaultValue={from?.slice(0, 10) ?? ""} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
            To
          </label>
          <input type="date" name="to" defaultValue={to?.slice(0, 10) ?? ""} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
            Status
          </label>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">All</option>
            <option value="rejected">Rejected (exceptions)</option>
            <option value="accepted">Accepted</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        <button type="submit">Apply filter</button>
        {hasFilter && (
          <Link href="/register" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Clear
          </Link>
        )}
      </form>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {events.length === 0 ? (
          // NFR-05: explicit empty state.
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
            {hasFilter ? "No events match this filter." : "No events recorded yet."}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event ref</th>
                <th>Source</th>
                <th>Start</th>
                <th>End</th>
                <th style={{ textAlign: "right" }}>Volume</th>
                <th>Status</th>
                <th>Detail</th>
                {canAmend && <th></th>}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.event_ref}</td>
                  <td>{e.source_code}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtDate(e.start_datetime)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtDate(e.end_datetime)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {e.reported_volume ? `${e.reported_volume} ${e.volume_unit}` : "\u2014"}
                  </td>
                  <td>
                    <StatusBadge event={e} />
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {e.is_voided ? e.void_reason : e.rejection_reasons.join(", ") || "\u2014"}
                  </td>
                  {canAmend && (
                    <td>
                      {!e.is_voided && (
                        <Link href={`/register/${e.id}/edit`} style={{ fontSize: 12, color: "var(--vent)" }}>
                          Edit
                        </Link>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
        {events.length} event{events.length === 1 ? "" : "s"} shown
      </p>
    </div>
  );
}
