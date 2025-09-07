"use client";
import { useSession } from "next-auth/react";

export default function MusicPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <main style={{padding:24}}>Chargement…</main>;
  if (!session) return <main style={{padding:24}}>Pas de session. Reviens via “Se connecter avec Spotify”.</main>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Connecté à Spotify ✅</h1>
      <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8 }}>
        {JSON.stringify(session, null, 2)}
      </pre>
      <p>Si tu vois un <code>accessToken</code>, l’OAuth est OK.</p>
    </main>
  );
}
