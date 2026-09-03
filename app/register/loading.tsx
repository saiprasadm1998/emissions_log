export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="skeleton" style={{ height: 28, width: 180 }} />
      <div className="skeleton panel" style={{ height: 76 }} />
      <div className="skeleton panel" style={{ height: 400 }} />
    </div>
  );
}
