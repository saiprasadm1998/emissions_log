import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getSources } from "@/lib/events";
import EventForm from "@/components/EventForm";

export const dynamic = "force-dynamic";

// Server component: the source dropdown's options are fetched directly
// from the database (no client fetch needed for this static-per-load
// list). Only the interactive form itself (typing, submitting, showing
// validation errors) needs to be a client component -- see EventForm.tsx.
export default async function NewEntryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Section 8: only Data Entry and Approver may create events -- Auditor
  // is explicitly Denied. Checked here too (not just in the API route)
  // so an Auditor never even sees the form -- the API route remains the
  // real enforcement point (NFR-03), this is a UX improvement on top of it.
  if (user.role === "AUDITOR") {
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Your role (Auditor) doesn&apos;t have permission to create events.
        </p>
      </div>
    );
  }

  const sources = await getSources();
  const activeSources = sources.filter((s) => s.status === "ACTIVE");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>New event entry</h1>
      <EventForm sources={activeSources} />
    </div>
  );
}

