export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="skeleton" style={{ height: 28, width: 260 }} />
      <div className="skeleton panel" style={{ height: 130 }} />
      <div className="skeleton panel" style={{ height: 130 }} />
      <div className="skeleton panel" style={{ height: 130 }} />
    </div>
  );
}
