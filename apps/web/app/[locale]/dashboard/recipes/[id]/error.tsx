"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Recipe detail error:", error);
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="section">
        <h2 style={{ marginTop: 0 }}>Impossible d’afficher la recette</h2>
        <p>Un problème est survenu lors du chargement de cette recette.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-dash" onClick={() => reset()}>Réessayer</button>
          <a className="btn btn-outline" href="/dashboard/recipes">Retour aux recettes</a>
        </div>
      </div>
    </div>
  );
}
