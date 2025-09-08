"use client";
import { useSession, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const Playlists = dynamic(() => import("./Playlists"), { ssr: false });
const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <main style={{padding:24}}>Chargement…</main>;

  if (!session) {
    return (
      <main style={{padding:24}}>
        Pas connecté.{" "}
        <a href="/api/auth/signin/spotify?callbackUrl=%2Fdashboard%2Fmusic">Se connecter</a>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h1>Vos playlists</h1>
        <button onClick={() => signOut({ callbackUrl: "/sign-in" })}>Se déconnecter</button>
      </div>

      {/* Player */}
      <SpotifyPlayer />

      {/* Liste des playlists */}
      <Playlists />
    </main>
  );
}
