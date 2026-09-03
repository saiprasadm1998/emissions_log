export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="skeleton" style={{ height: 28, width: 220 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        <div className="skeleton panel" style={{ height: 110 }} />
        <div className="skeleton panel" style={{ height: 110 }} />
      </div>
      <div className="skeleton panel" style={{ height: 220 }} />
      <div className="skeleton panel" style={{ height: 240 }} />
    </div>
  );
}
