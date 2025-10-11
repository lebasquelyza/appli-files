// apps/web/app/dashboard/music/page.tsx
"use client";

import * as React from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
// const Timer = dynamic(() => import("@/components/Timer"), { ssr: false }); // si besoin

export default function MusicPage() {
  const s = useSession();
  const session = s?.data ?? null;
  const status: "loading" | "authenticated" | "unauthenticated" = (s?.status as any) ?? "unauthenticated";

  // 🔐 Si pas connecté → lance l’OAuth Spotify automatiquement
  React.useEffect(() => {
    if (status === "unauthenticated") {
      // redirect:true par défaut — garde le callback sur /dashboard/music
      signIn("spotify", { callbackUrl: "/dashboard/music" });
    }
  }, [status]);

  if (status === "loading") return <main className="p-6">Chargement…</main>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Musique</h1>
        {session ? (
          <button onClick={() => signOut({ callbackUrl: "/dashboard/music" })} className="btn-dash">
            Se déconnecter
          </button>
        ) : (
          <button onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })} className="btn-dash">
            Se connecter
          </button>
        )}
      </div>

      {/* Petit debug visible pour toi */}
      <div className="text-xs" style={{ color: "#6b7280" }}>
        session status: <b>{status}</b>
      </div>

      {session ? (
        <SpotifyPlayer />
      ) : (
        <p className="text-sm" style={{ color: "var(--muted, #6b7280)" }}>
          Redirection vers Spotify… Si ça boucle, vérifie NEXTAUTH_URL et la callback Spotify.
        </p>
      )}

      {/* <div className="card"><Timer /></div> */}
    </main>
  );
}

