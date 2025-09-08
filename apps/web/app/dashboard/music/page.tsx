"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Chrono = dynamic(() => import("@/components/Chrono"), { ssr: false });

const btn = "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 active:translate-y-px transition dark:text-white dark:bg-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800";
const btnOutline = "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 bg-transparent hover:bg-gray-100 active:translate-y-px transition dark:text-white dark:border-neutral-700 dark:hover:bg-neutral-800";

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
            className={btnOutline}
            title="Se déconnecter"
          >
            Se déconnecter
          </button>
        ) : (
          <button
            onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })}
            className={btn}
            title="Se connecter"
          >
            Se connecter
          </button>
        )}
      </div>

      {/* Chronomètre toujours visible */}
      <Chrono />

      {/* Player visible seulement si connecté */}
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
