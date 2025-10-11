"use client";

import * as React from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import nextDynamic from "next/dynamic"; // alias pour éviter le conflit avec export const dynamic

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Import dynamique (client-only)
const SpotifyPlayer = nextDynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });

// Petite ErrorBoundary client pour encapsuler le player
class PlayerBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; msg?: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, msg: String(err?.message || err) };
  }
  componentDidCatch(err: any) {
    console.error("Player error:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: 12 }}>
          <div className="text-sm" style={{ color: "#b91c1c" }}>Le lecteur a rencontré une erreur.</div>
          {this.state.msg && <pre className="text-xs" style={{ whiteSpace: "pre-wrap" }}>{this.state.msg}</pre>}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MusicPage() {
  const s = useSession();
  const session = s?.data ?? null;
  const status: "loading" | "authenticated" | "unauthenticated" = (s?.status as any) ?? "unauthenticated";

  // On attend le montage pour injecter le player (évite crashs au 1er render)
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (status === "loading") return <main className="p-6">Chargement…</main>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Musique</h1>
        {session ? (
          <button onClick={() => signOut({ callbackUrl: "/dashboard/music" })} className="btn-dash">Se déconnecter</button>
        ) : (
          <button onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })} className="btn-dash">Se connecter</button>
        )}
      </div>

      <div className="text-xs" style={{ color: "#6b7280" }}>
        session status: <b>{status}</b> · mounted: <b>{String(mounted)}</b>
      </div>

      {session ? (
        mounted ? (
          <PlayerBoundary>
            <SpotifyPlayer />
          </PlayerBoundary>
        ) : (
          <div className="card">Initialisation…</div>
        )
      ) : (
        <p className="text-sm" style={{ color: "var(--muted, #6b7280)" }}>
          Connecte ton compte Spotify pour utiliser le lecteur.
        </p>
      )}
    </main>
  );
}


