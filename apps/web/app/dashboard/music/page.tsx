"use client";

import * as React from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import nextDynamic from "next/dynamic"; // ✅ alias pour éviter le conflit de nom

export const dynamic = "force-dynamic"; // ✅ garde le nom exact pour la config Next.js
export const revalidate = 0;

const SpotifyPlayer = nextDynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
// Active si tu veux afficher le Timer aussi
// const Timer = nextDynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const s = useSession();
  const session = s?.data ?? null;
  const status: "loading" | "authenticated" | "unauthenticated" =
    (s?.status as any) ?? "unauthenticated";

  if (status === "loading") return <main className="p-6">Chargement…</main>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Musique</h1>
        {session ? (
          <button
            onClick={() => signOut({ callbackUrl: "/dashboard/music" })}
            className="btn-dash"
          >
            Se déconnecter
          </button>
        ) : (
          <button
            onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })}
            className="btn-dash"
          >
            Se connecter
          </button>
        )}
      </div>

      {/* Debug utile tant que tu finalises l’auth */}
      <div className="text-xs" style={{ color: "#6b7280" }}>
        session status: <b>{status}</b>
      </div>

      {session ? (
        <SpotifyPlayer />
      ) : (
        <p className="text-sm" style={{ color: "var(--muted, #6b7280)" }}>
          Connecte ton compte Spotify pour utiliser le lecteur.
        </p>
      )}

      {/* Exemple si tu veux réactiver le Timer */}
      {/* <div className="card"><Timer /></div> */}
    </main>
  );
}

