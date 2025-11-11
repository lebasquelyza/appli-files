"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });

/* ---------------- Audio utils ---------------- */
function useAudioChime() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);

  const ensureAudioCtx = useCallback(async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const unlock = useCallback(async () => {
    if (unlockedRef.current) return;
    try {
      const ctx = await ensureAudioCtx();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      unlockedRef.current = true;
    } catch {}
  }, [ensureAudioCtx]);

  const chimeStrong = useCallback(async () => {
    try {
      const ctx = await ensureAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 1200;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.9, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }, [ensureAudioCtx]);

  return { unlock, chimeStrong };
}

/* ---------------- Minuteur simple réglable ---------------- */
function SimpleTimer() {
  const { unlock, chimeStrong } = useAudioChime();

  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(30);
  const [remaining, setRemaining] = useState(30);
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const totalSec = useMemo(
    () => Math.max(1, minutes * 60 + seconds),
    [minutes, seconds]
  );

  useEffect(() => {
    if (!running && !hasStarted) {
      setRemaining(totalSec);
    }
  }, [totalSec, running, hasStarted]);

  const start = () => {
    if (totalSec < 1) return;
    setRemaining(totalSec);
    setHasStarted(true);
    setRunning(true);
  };

  const pause = () => setRunning(false);
  const resume = () => setRunning(true);

  const reset = () => {
    setRunning(false);
    setHasStarted(false);
    setRemaining(totalSec);
  };

  useEffect(() => {
    if (!running) return;

    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          void chimeStrong();
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [running, chimeStrong]);

  const pct = Math.round(((totalSec - remaining) / totalSec) * 100);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div
      onPointerDown={unlock}
      onKeyDown={unlock as any}
      style={{ display: "grid", gap: 8 }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <label className="label" style={{ fontSize: 12, flex: 1 }}>
          Minutes
          <input
            className="input"
            type="number"
            min={0}
            max={120}
            value={minutes}
            onChange={(e) =>
              setMinutes(Math.max(0, Math.min(120, Number(e.target.value) || 0)))
            }
            style={{ marginTop: 4, padding: "6px 8px", fontSize: 13 }}
          />
        </label>
        <label className="label" style={{ fontSize: 12, flex: 1 }}>
          Secondes
          <input
            className="input"
            type="number"
            min={0}
            max={59}
            value={seconds}
            onChange={(e) =>
              setSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
            }
            style={{ marginTop: 4, padding: "6px 8px", fontSize: 13 }}
          />
        </label>
      </div>

      <div
        className="panel"
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          borderRadius: 12,
          padding: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
            Minuteur simple
          </div>
          <div
            style={{
              fontFamily: "tabular-nums",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
        </div>

        <div
          style={{
            height: 8,
            background: "#f3f4f6",
            borderRadius: 999,
            marginTop: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "#16a34a",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          {!hasStarted || (!running && remaining === totalSec) ? (
            <button
              className="btn btn-dash"
              style={{ fontSize: 13 }}
              onClick={start}
            >
              Démarrer
            </button>
          ) : running ? (
            <button
              className="btn btn-dash"
              style={{ fontSize: 13 }}
              onClick={pause}
            >
              Pause
            </button>
          ) : (
            <button
              className="btn btn-dash"
              style={{ fontSize: 13 }}
              onClick={resume}
            >
              Reprendre
            </button>
          )}
          <button
            className="btn"
            style={{
              fontSize: 13,
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
            }}
            onClick={reset}
          >
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tabata Timer (compact) ---------------- */
function TabataTimerCompact() {
  const { unlock, chimeStrong } = useAudioChime();

  const [rounds, setRounds] = useState(8);
  const [workSec, setWorkSec] = useState(20);
  const [restSec, setRestSec] = useState(10);

  const [phase, setPhase] = useState<"idle" | "work" | "rest" | "done">("idle");
  const [currRound, setCurrRound] = useState(1);
  const [remaining, setRemaining] = useState(workSec);
  const [running, setRunning] = useState(false);

  const totalSec = useMemo(
    () => rounds * (workSec + restSec) - restSec,
    [rounds, workSec, restSec]
  );

  const elapsedSec = useMemo(() => {
    if (phase === "idle") return 0;
    let elapsed = 0;
    const fullRoundsDone = currRound - 1;
    elapsed += fullRoundsDone * (workSec + restSec);
    if (phase === "work") elapsed += workSec - remaining;
    if (phase === "rest") elapsed += workSec + (restSec - remaining);
    if (phase === "done") elapsed = totalSec;
    return Math.max(0, Math.min(elapsed, totalSec));
  }, [phase, currRound, remaining, workSec, restSec, totalSec]);

  const start = () => {
    if (rounds < 1 || workSec < 1) return;
    setCurrRound(1);
    setPhase("work");
    setRemaining(workSec);
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const resume = () => setRunning(true);
  const reset = () => {
    setRunning(false);
    setPhase("idle");
    setCurrRound(1);
    setRemaining(workSec);
  };

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (r > 1) return next;

        void chimeStrong();

        if (phase === "work") {
          if (currRound === rounds) {
            setPhase("done");
            setRunning(false);
            return 0;
          } else {
            setPhase("rest");
            return restSec || 0;
          }
        } else if (phase === "rest") {
          setPhase("work");
          setCurrRound((n) => n + 1);
          return workSec;
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, phase, currRound, rounds, workSec, restSec, chimeStrong]);

  useEffect(() => {
    if (!running && (phase === "idle" || phase === "done")) setRemaining(workSec);
  }, [workSec, running, phase]);

  const pct = totalSec ? Math.round((elapsedSec / totalSec) * 100) : 0;

  return (
    <div
      onPointerDown={unlock}
      onKeyDown={unlock as any}
      style={{ display: "grid", gap: 8 }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
        }}
      >
        <label className="label" style={{ fontSize: 12 }}>
          Rounds
          <input
            className="input"
            type="number"
            min={1}
            max={50}
            value={rounds}
            onChange={(e) =>
              setRounds(Math.max(1, Math.min(50, Number(e.target.value) || 0)))
            }
            style={{ marginTop: 4, padding: "6px 8px", fontSize: 13 }}
          />
        </label>
        <label className="label" style={{ fontSize: 12 }}>
          Travail (s)
          <input
            className="input"
            type="number"
            min={1}
            max={3600}
            value={workSec}
            onChange={(e) =>
              setWorkSec(Math.max(1, Math.min(3600, Number(e.target.value) || 0)))
            }
            style={{ marginTop: 4, padding: "6px 8px", fontSize: 13 }}
          />
        </label>
        <label className="label" style={{ fontSize: 12 }}>
          Repos (s)
          <input
            className="input"
            type="number"
            min={0}
            max={3600}
            value={restSec}
            onChange={(e) =>
              setRestSec(Math.max(0, Math.min(3600, Number(e.target.value) || 0)))
            }
            style={{ marginTop: 4, padding: "6px 8px", fontSize: 13 }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          className="btn"
          style={{ fontSize: 12 }}
          onClick={() => {
            setRounds(8);
            setWorkSec(20);
            setRestSec(10);
          }}
        >
          Tabata 8× 20/10
        </button>
        <button
          className="btn"
          style={{ fontSize: 12 }}
          onClick={() => {
            setRounds(10);
            setWorkSec(45);
            setRestSec(15);
          }}
        >
          10× 45/15
        </button>
        <button
          className="btn"
          style={{ fontSize: 12 }}
          onClick={() => {
            setRounds(6);
            setWorkSec(30);
            setRestSec(30);
          }}
        >
          6× 30/30
        </button>
      </div>

      <div
        className="panel"
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          borderRadius: 12,
          padding: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
            {phase === "work"
              ? "Travail"
              : phase === "rest"
              ? "Repos"
              : phase === "done"
              ? "Terminé"
              : "Prêt"}
            {phase !== "idle" && phase !== "done" ? ` — Round ${currRound}/${rounds}` : ""}
          </div>
          <div
            style={{
              fontFamily: "tabular-nums",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </div>
        </div>

        <div
          style={{
            height: 8,
            background: "#f3f4f6",
            borderRadius: 999,
            marginTop: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "#16a34a",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          {phase === "idle" || phase === "done" ? (
            <button
              className="btn btn-dash"
              style={{ fontSize: 13 }}
              onClick={start}
            >
              Démarrer
            </button>
          ) : running ? (
            <button
              className="btn btn-dash"
              style={{ fontSize: 13 }}
              onClick={pause}
            >
              Pause
            </button>
          ) : (
            <button
              className="btn btn-dash"
              style={{ fontSize: 13 }}
              onClick={resume}
            >
              Reprendre
            </button>
          )}
          <button
            className="btn"
            style={{
              fontSize: 13,
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
            }}
            onClick={reset}
          >
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Spotify Library (likés + recherche) ---------------- */

type Track = {
  id: string;
  name: string;
  artists: string;
  image: string | null;
  uri: string;
};

async function spFetch<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify API ${res.status} ${path}`);
  return res.json();
}

function SpotifyLibrary() {
  const { data: session, status } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [liked, setLiked] = useState<Track[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    setLoadingLikes(true);
    setError(null);

    (async () => {
      try {
        const data = await spFetch<any>(token, "/me/tracks?limit=20");
        const items = (data?.items || []) as any[];
        const mapped: Track[] = items.map((it) => {
          const t = it.track;
          return {
            id: t.id,
            name: t.name,
            artists: (t.artists || []).map((a: any) => a.name).join(", "),
            image: t.album?.images?.[0]?.url || null,
            uri: t.uri,
          };
        });
        setLiked(mapped);
      } catch (e: any) {
        setError(e?.message || "Impossible de récupérer les titres likés");
      } finally {
        setLoadingLikes(false);
      }
    })();
  }, [status, token]);

  const playTrack = async (uri: string) => {
    if (!token) return;
    const deviceId = typeof window !== "undefined" ? window.__sp_deviceId : null;
    if (!deviceId) {
      setError("Player Spotify non prêt. Lance le lecteur d’abord.");
      return;
    }
    try {
      await spFetch(token, `/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({ uris: [uri] }),
      });
    } catch (e: any) {
      setError(e?.message || "Impossible de lancer la lecture");
    }
  };

  const onSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !search.trim()) return;
    setLoadingSearch(true);
    setError(null);
    try {
      const q = encodeURIComponent(search.trim());
      const data = await spFetch<any>(token, `/search?type=track&limit=15&q=${q}`);
      const items = data?.tracks?.items || [];
      const mapped: Track[] = items.map((t: any) => ({
        id: t.id,
        name: t.name,
        artists: (t.artists || []).map((a: any) => a.name).join(", "),
        image: t.album?.images?.[0]?.url || null,
        uri: t.uri,
      }));
      setResults(mapped);
    } catch (e: any) {
      setError(e?.message || "Erreur de recherche");
    } finally {
      setLoadingSearch(false);
    }
  };

  if (status !== "authenticated" || !token) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Connecte-toi à Spotify pour voir tes titres likés et rechercher une musique.
      </p>
    );
  }

  return (
    <section className="space-y-6">
      {error && (
        <p className="text-sm" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      <div>
        <h3 className="font-semibold text-sm mb-2">Titres likés</h3>
        {loadingLikes ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Chargement…
          </p>
        ) : liked.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Aucun titre liké trouvé.
          </p>
        ) : (
          <ul className="space-y-2">
            {liked.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-[10px] border px-3 py-2"
                style={{ borderColor: "rgba(0,0,0,.06)", background: "var(--bg)" }}
              >
                {t.image && (
                  <img
                    src={t.image}
                    alt=""
                    width={40}
                    height={40}
                    style={{ borderRadius: 6, flexShrink: 0, objectFit: "cover" }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="truncate text-xs" style={{ color: "var(--muted)" }}>
                    {t.artists}
                  </div>
                </div>
                <button
                  className="btn btn-dash"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  onClick={() => playTrack(t.uri)}
                >
                  Lire
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-2">Rechercher une musique</h3>
        <form onSubmit={onSearchSubmit} className="flex gap-2 mb-3">
          <input
            className="input flex-1"
            placeholder="Nom du titre, artiste…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: 13, padding: "6px 10px" }}
          />
          <button type="submit" className="btn btn-dash" style={{ fontSize: 13 }}>
            Rechercher
          </button>
        </form>

        {loadingSearch ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Recherche en cours…
          </p>
        ) : results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-[10px] border px-3 py-2"
                style={{ borderColor: "rgba(0,0,0,.06)", background: "var(--bg)" }}
              >
                {t.image && (
                  <img
                    src={t.image}
                    alt=""
                    width={40}
                    height={40}
                    style={{ borderRadius: 6, flexShrink: 0, objectFit: "cover" }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="truncate text-xs" style={{ color: "var(--muted)" }}>
                    {t.artists}
                  </div>
                </div>
                <button
                  className="btn btn-dash"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  onClick={() => playTrack(t.uri)}
                >
                  Lire
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------- Page ---------------- */

export default function MusicPage() {
  const { data: session, status } = useSession();

  const PAGE_MAX_WIDTH = 740;
  const SIDE_PADDING = 16;
  const PLAYER_SCALE = 0.84;
  const invPlayer = 1 / PLAYER_SCALE;

  if (status === "loading") {
    return (
      <div
        className="container"
        style={{
          paddingTop: 18,
          paddingBottom: 22,
          paddingLeft: SIDE_PADDING,
          paddingRight: SIDE_PADDING,
          maxWidth: PAGE_MAX_WIDTH,
          margin: "0 auto",
        }}
      >
        <div className="page-header" style={{ marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>
              Musique
            </h1>
            <p className="lead" style={{ fontSize: 12, marginTop: 2 }}>
              Chargement…
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <article className="card" style={{ padding: 10 }}>
            <div style={{ height: 110, background: "#f3f4f6" }} />
          </article>
          <article className="card" style={{ padding: 10 }}>
            <div style={{ height: 110, background: "#f3f4f6" }} />
          </article>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container"
      style={{
        paddingTop: 18,
        paddingBottom: 22,
        paddingLeft: SIDE_PADDING,
        paddingRight: SIDE_PADDING,
        maxWidth: PAGE_MAX_WIDTH,
        margin: "0 auto",
      }}
    >
      <div className="page-header" style={{ marginBottom: 6 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>
            Musique
          </h1>
          <p className="lead" style={{ fontSize: 12, marginTop: 2 }}>
            Minuteur simple + Tabata + lecteur Spotify + titres likés.
          </p>
        </div>
        <div>
          {session ? (
            <button
              onClick={() => signOut({ callbackUrl: "/dashboard/music" })}
              className="btn btn-dash"
              title="Se déconnecter"
              style={{ fontSize: 13 }}
            >
              ⏻ Se déconnecter
            </button>
          ) : (
            <button
              onClick={() =>
                signIn("spotify", { callbackUrl: "/dashboard/music" })
              }
              className="btn btn-dash"
              style={{ fontSize: 13 }}
            >
              Se connecter à Spotify
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Carte Timer */}
        <article className="card" style={{ padding: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                fontSize: 16,
                color: "#111827",
                fontWeight: 800,
              }}
            >
              Timer
            </h3>

            <button
              type="button"
              className="btn"
              style={{
                fontSize: 12,
                padding: "6px 10px",
                background: "#ffffff",
                color: "#111827",
                border: "1px solid #d1d5db",
                borderRadius: 999,
                fontWeight: 600,
              }}
              onClick={() => {
                const el = document.getElementById("tabata-root");
                if (el)
                  el.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
              }}
            >
              Tabata
            </button>
          </div>

          <div
            style={{
              marginTop: 8,
              display: "grid",
              gap: 10,
            }}
          >
            <section>
              <SimpleTimer />
            </section>

            <section id="tabata-root">
              <TabataTimerCompact />
            </section>
          </div>
        </article>

        {/* Carte Spotify */}
        <article className="card" style={{ padding: 10 }}>
          <h3
            style={{
              marginTop: 0,
              fontSize: 14,
              color: "#111827",
            }}
          >
            Lecteur Spotify
          </h3>
          <div
            className="text-sm"
            style={{
              color: "#6b7280",
              fontSize: 13,
              marginTop: 2,
            }}
          >
            {session
              ? "Contrôle du lecteur connecté à ton compte."
              : "Connecte-toi pour utiliser le lecteur Spotify."}
          </div>
          {session ? (
            <div
              style={{
                marginTop: 8,
                fontSize: "92%",
                transform: `scale(${PLAYER_SCALE})`,
                transformOrigin: "top left",
                width: `${(invPlayer * 100).toFixed(3)}%`,
              }}
            >
              <SpotifyPlayer />
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <button
                className="btn btn-dash"
                onClick={() =>
                  signIn("spotify", {
                    callbackUrl: "/dashboard/music",
                  })
                }
                style={{ fontSize: 13 }}
              >
                Se connecter
              </button>
            </div>
          )}
        </article>
      </div>

      {/* Carte Titres likés + recherche */}
      <article className="card" style={{ padding: 10, marginTop: 12 }}>
        <SpotifyLibrary />
      </article>
    </div>
  );
}
