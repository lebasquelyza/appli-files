"use client";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="card">
        <h2 style={{ margin: 0 }}>Oups</h2>
        <p className="text-sm" style={{ whiteSpace: "pre-wrap", color: "#6b7280" }}>
          {error?.message || "Erreur inconnue"}{error?.digest ? `\n(digest: ${error.digest})` : ""}
        </p>
        <button className="btn btn-dash" onClick={() => reset()}>Recharger</button>
      </div>
    </div>
  );
}
