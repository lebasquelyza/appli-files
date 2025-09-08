"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

const btnDangerOutline = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-red-600 border border-red-300 hover:bg-red-50 active:translate-y-px transition focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 dark:text-red-300 dark:border-red-500/50 dark:hover:bg-red-500/10 dark:focus:ring-offset-0";
const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 active:translate-y-px transition focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-0";

export default function MusicPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <main className="p-6">Chargement…</main>;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lecteur Spotify</h1>

        {session ? (
          <button
            onClick={() => signOut({ callbackUrl: "/dashboard/music" })}
            className={btnDangerOutline}
            title="Se déconnecter"
          >
            ⏻ Se déconnecter
          </button>
        ) : (
          <button
            onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })}
            className={btnPrimary}
            title="Se connecter"
          >
            🔗 Se connecter
          </button>
        )}
      </div>

      {/* Minuteur (toujours visible) */}
      <Timer />

      {/* Player visible uniquement si connecté */}
      {session ? (
        <SpotifyPlayer />
      ) : (
        <p className="text-sm text-gray-600">
          Connecte ton compte Spotify pour utiliser le lecteur.
        </p>
      )}
    </main>
  );
}
