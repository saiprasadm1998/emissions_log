export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <div className="skeleton" style={{ height: 28, width: 200 }} />
      <div className="skeleton panel" style={{ height: 420 }} />
    </div>
  );
}
