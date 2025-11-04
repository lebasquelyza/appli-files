"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Recipes error:", error);

  return (
    <>
      {/* spacer topbar fixe */}
      <div className="h-10" aria-hidden="true" />

      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="section">
          <h2 style={{ marginTop: 0 }}>Une erreur est survenue</h2>
          <p>La page des recettes a rencontré un problème.</p>

          {/* 🔍 Debug : on affiche le message d'erreur */}
          <p className="text-xs" style={{ color: "#6b7280", marginTop: 8 }}>
            Détail technique : <strong>{error?.message}</strong>
          </p>

          {error?.stack && (
            <pre
              style={{
                marginTop: 8,
                background: "#f3f4f6",
                padding: 8,
                borderRadius: 4,
                fontSize: 11,
                whiteSpace: "pre-wrap",
                maxHeight: 220,
                overflow: "auto",
              }}
            >
              {error.stack}
            </pre>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="btn btn-dash" onClick={() => reset()}>
              Réessayer
            </button>
            <a className="btn btn-outline" href="/dashboard">
              Retour au tableau de bord
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

