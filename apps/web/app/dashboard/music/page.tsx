// apps/web/app/dashboard/music/page.tsx
"use client";

import * as React from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import nextDynamic from "next/dynamic"; // alias pour éviter le conflit avec `export const dynamic`

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ⏱️ Timer reste un fichier séparé (apps/web/components/Timer.tsx)
const Timer = nextDynamic(() => import("@/components/Timer"), { ssr: false });

// --- Types locaux pour l'affichage ---
type NowPlaying = {
  name: string;
  artists: string;
  image: string | null;
  isPlaying: boolean;
  device?: string | null;
};

// --- Helper pour l’API Web Spotify (mobile-safe) ---
async function spFetch<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify API ${res.status} ${path}`);
  return res.json();
}

export default function MusicPage() {
  const s = useSession();
  const session = s?.data ?? null;
  const status: "loading" | "authenticated" | "unauthenticated" = (s?.status as any) ?? "unauthenticated";

  // ⚠️ Assure-toi que tu exposes bien l'accessToken dans la session NextAuth
  const token = (session as any)?.accessToken as string | undefined;

  // --- État “Now Playing” directement dans la page ---
  const [now, setNow] = React.useState<NowPlaying | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status !== "authenticated" || !token) return;

    let stop = false;
    const load = async () => {
      try {
        const data = await spFetch<any>(token, "/me/player");
        if (stop) return;
        const isPlaying = !!data?.is_playing;
        const item = data?.item;
        const name = item?.name as string | undefined;
        const artists = item?.artists?.map((a: any) => a?.name).filter(Boolean).join(", ") || "";
        const image = item?.album?.images?.[0]?.url || null;
        const device = data?.device?.name ?? null;
        setNow(name ? { name, artists, image, isPlaying, device } : null);
        setError(null);
      } catch (e: any) {
        if (!stop) setError(e?.message || String(e));
      }
    };

    // 1er fetch + polling + refresh au retour d’onglet
    load();
    const id = window.setInterval(load, 6000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status, token]);

  if (status === "loading") {
    return <main className="p-6">Chargement…</main>;
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
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

      {session ? (
        <>
          {/* 🎵 Musique en cours (intégrée ici, sans SDK → compatible iOS/Android) */}
          <section className="space-y-3">
            {error && (
              <div className="text-xs" style={{ color: "#dc2626" }}>
                Spotify: {error}
              </div>
            )}

            <div
              className="flex items-center gap-6 rounded-[14px]"
              style={{
                background: "var(--bg)",
                border: "1px solid rgba(0,0,0,.08)",
                boxShadow: "var(--shadow)",
                padding: "18px",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  background: "var(--panel)",
                  border: "1px solid rgba(0,0,0,.06)",
                  overflow: "hidden",
                  flex: "0 0 auto",
                }}
              >
                {now?.image ? (
                  <img
                    src={now.image}
                    alt=""
                    width={72}
                    height={72}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ fontWeight: 700 }}>
                  {now?.name || "Aucune lecture en cours"}
                </div>
                <div className="truncate" style={{ color: "var(--muted)" }}>
                  {now?.artists || (now ? (now.isPlaying ? "Lecture en cours" : "En pause") : "—")}
                </div>
                {now?.device && (
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    Appareil : {now.device}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <a className="btn btn-outline" href="spotify://" aria-label="Ouvrir Spotify">
                  Ouvrir
                </a>
                <a
                  className="btn btn-outline"
                  href="https://open.spotify.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Web
                </a>
              </div>
            </div>
          </section>

          {/* ⏱️ Minuteur (fichier séparé) */}
          <section className="card">
            <h2 className="text-lg font-semibold" style={{ marginTop: 0 }}>
              Minuteur
            </h2>
            <Timer />
          </section>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--muted, #6b7280)" }}>
          Connecte ton compte Spotify pour afficher la piste en cours et utiliser le minuteur.
        </p>
      )}
    </main>
  );
}
