"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-semibold">Oups, la page Musique a planté</h2>
      <pre className="text-xs" style={{ whiteSpace: "pre-wrap" }}>
        {String(error?.message || error)}
      </pre>
      <button className="btn-dash" onClick={() => reset()}>Réessayer</button>
    </main>
  );
}
