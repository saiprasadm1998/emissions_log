import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getFactors } from "@/lib/events";
import SupersedeFactorForm from "@/components/SupersedeFactorForm";

export const dynamic = "force-dynamic";

// FR-11: supersession creates a new validity period and closes the
// preceding one, never permitting modification of the superseded record
// (enforced server-side by app/api/factors/supersede/route.ts -- this
// page only ever calls that route, never issues an UPDATE of its own).
export default async function SupersedeFactorPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.role !== "APPROVER") {
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Your role ({user.role}) doesn&apos;t have permission to supersede emission factors.
        </p>
      </div>
    );
  }

  const factors = await getFactors();
  const openFactors = factors.filter((f) => f.valid_to === null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Supersede an emission factor</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        Closes the currently open validity period and opens a new one. The superseded record is never modified —
        every historical calculation keeps pointing at the exact version it used.
      </p>
      <SupersedeFactorForm openFactors={openFactors} />
    </div>
  );
}
