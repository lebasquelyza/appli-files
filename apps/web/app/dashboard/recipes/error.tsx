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
          <div style={{ display: "flex", gap: 10 }}>
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
