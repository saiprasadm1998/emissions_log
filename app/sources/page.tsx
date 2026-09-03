import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getSources } from "@/lib/events";

export const dynamic = "force-dynamic";

// FR-01: source register, all 3 roles can view. Decommissioned sources
// visually distinguished (dimmed row + badge), not just a status column.
export default async function SourcesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let sources;
  try {
    sources = await getSources();
  } catch {
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Couldn&apos;t load the source register. The database may be unreachable.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Emission source register</h1>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {sources.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
            No sources registered yet.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Process unit</th>
                <th>Area</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source_code} style={{ opacity: s.status === "DECOMMISSIONED" ? 0.55 : 1 }}>
                  <td className="mono">{s.source_code}</td>
                  <td>{s.source_name}</td>
                  <td>
                    <span className={s.source_type === "FLARE" ? "badge badge-flare" : "badge badge-vent"}>
                      {s.source_type}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.process_unit ?? "\u2014"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.area ?? "\u2014"}</td>
                  <td>
                    {s.status === "ACTIVE" ? (
                      <span className="badge badge-accepted">Active</span>
                    ) : (
                      <span className="badge badge-voided">Decommissioned</span>
                    )}
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
