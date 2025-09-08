"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <main className="p-6">Chargement…</main>;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lecteur Spotify</h1>
        {session ? (
          <button onClick={() => signOut({ callbackUrl: "/dashboard/music" })} className="btn-dash" title="Se déconnecter">
            ⏻ Se déconnecter
          </button>
        ) : (
          <button onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })} className="btn-dash" title="Se connecter">
            🔗 Se connecter
          </button>
        )}
      </div>

      {/* Minuteur (avec beep) */}
      <Timer />

      {/* Player visible uniquement si connecté */}
      {session ? <SpotifyPlayer /> : <p className="text-sm" style={{color:"var(--muted)"}}>Connecte ton compte Spotify pour utiliser le lecteur.</p>}
    </main>
  );
}
