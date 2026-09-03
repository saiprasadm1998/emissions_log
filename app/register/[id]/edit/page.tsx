import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getEventById, getSources } from "@/lib/events";
import EventForm from "@/components/EventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // FR-04 / Section 8: Data Entry and Approver may amend, Auditor may not.
  if (user.role === "AUDITOR") {
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Your role (Auditor) doesn&apos;t have permission to amend events.
        </p>
      </div>
    );
  }

  const [existingEvent, sources] = await Promise.all([getEventById(id), getSources()]);

  if (!existingEvent) {
    notFound();
  }

  if (existingEvent.is_voided) {
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>This event has been voided and can no longer be amended.</p>
      </div>
    );
  }

  const activeSources = sources.filter((s) => s.status === "ACTIVE" || s.source_code === existingEvent.source_code);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
        Amend event <span className="mono">{existingEvent.event_ref}</span>
      </h1>
      <EventForm sources={activeSources} existingEvent={existingEvent} />
    </div>
  );
}
