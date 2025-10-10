"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Oups, la page Musique a planté</h2>
      <p className="text-sm">Détail :</p>
      <pre className="text-xs" style={{ whiteSpace: "pre-wrap" }}>{String(error?.message || error)}</pre>
      <button className="btn btn-dash" onClick={() => reset()} style={{ marginTop: 8 }}>
        Réessayer
      </button>
    </div>
  );
}
