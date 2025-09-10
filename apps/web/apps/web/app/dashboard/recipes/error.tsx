"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Oups, un souci est survenu</h2>
        <p className="text-sm" style={{ color: "#6b7280", whiteSpace: "pre-wrap" }}>
          {error?.message || "Erreur inconnue"}
          {error?.digest ? `\n(digest: ${error.digest})` : ""}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-dash" onClick={() => reset()}>Recharger</button>
          <a className="btn btn-outline" href="/dashboard">← Retour</a>
        </div>
      </div>
    </div>
  );
}
