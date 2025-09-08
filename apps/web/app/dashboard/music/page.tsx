"use client";
import { useSession } from "next-auth/react";
import Playlists from "./Playlists";

export default function MusicPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <main style={{padding:24}}>Chargement…</main>;

  if (!session) {
    return (
      <main style={{padding:24}}>
        Pas connecté.{" "}
        <a href="/api/auth/signin/spotify?callbackUrl=%2Fdashboard%2Fmusic">
          Se connecter
        </a>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Vos playlists</h1>
      <Playlists />
    </main>
  );
}
