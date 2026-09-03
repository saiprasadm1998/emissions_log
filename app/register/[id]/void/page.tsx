import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getEventById } from "@/lib/events";
import VoidEventForm from "@/components/VoidEventForm";

export const dynamic = "force-dynamic";

// Section 8: void is Approver only, and requires a recorded reason --
// enforced server-side in app/api/events/[id]/void/route.ts. This page
// only ever calls that route.
export default async function VoidEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.role !== "APPROVER") {
    return (
      <div className="panel" style={{ padding: 24, borderColor: "var(--rejected)" }}>
        <p style={{ margin: 0, color: "var(--rejected)" }}>
          Your role ({user.role}) doesn&apos;t have permission to void events.
        </p>
      </div>
    );
  }

  const existingEvent = await getEventById(id);
  if (!existingEvent) {
    notFound();
  }

  if (existingEvent.is_voided) {
    return (
      <div className="panel" style={{ padding: 24 }}>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          This event is already voided: {existingEvent.void_reason}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
        Void event <span className="mono">{existingEvent.event_ref}</span>
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        Voiding removes this event from all calculated totals. This cannot be undone. A reason is required.
      </p>
      <VoidEventForm eventId={existingEvent.id} eventRef={existingEvent.event_ref} />
    </div>
  );
}
