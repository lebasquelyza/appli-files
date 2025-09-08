"use client";
import { useSession, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <main className="p-6">Chargement…</main>;

  if (!session) {
    return (
      <main className="p-6">
        <p>
          Pas connecté.{" "}
          <a className="btn" href="/api/auth/signin/spotify?callbackUrl=%2Fdashboard%2Fmusic">
            Se connecter
          </a>
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lecteur Spotify</h1>
        <button onClick={() => signOut({ callbackUrl: "/sign-in" })} className="btn btn-outline">
          Se déconnecter
        </button>
      </div>

      <SpotifyPlayer />
    </main>
  );
}
