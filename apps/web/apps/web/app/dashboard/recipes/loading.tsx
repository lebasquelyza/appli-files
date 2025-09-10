export default function Loading() {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Chargement des recettes…</h2>
        <p className="text-sm" style={{ color: "#6b7280" }}>
          Un instant, nous préparons vos suggestions.
        </p>
      </div>
    </div>
  );
}
