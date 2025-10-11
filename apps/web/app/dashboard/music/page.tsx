"use client";

import * as React from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

// (optionnel) dé-commente si tu réintègres ces composants
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });
const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });

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

      <div className="card">Page minimale OK ✅ — on va réintroduire les composants ensuite.</div>

      {/* ⬇️ Garde le conditionnel DANS <main>, pas après */}
      {session ? (
        <SpotifyPlayer />
      ) : (
        <p className="text-sm" style={{ color: "var(--muted, #6b7280)" }}>
          Connecte ton compte Spotify pour utiliser le lecteur.
        </p>
      )}

      {/* Exemple : réactiver le Timer ici, toujours à l’intérieur de <main> */}
      {/* <div className="card"><Timer /></div> */}
    </main>
  );
}
