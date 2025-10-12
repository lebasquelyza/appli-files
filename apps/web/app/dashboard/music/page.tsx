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
      src.buffer = buffer; src.connect(ctx.destination); src.start(0);
      unlockedRef.current = true;
    } catch {}
  }, [ensureAudioCtx]);

  // Tick discret pour 3-2-1
  const tick = useCallback(async () => {
    try {
      const ctx = await ensureAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;     // petit bip
      gain.gain.value = 0.25;        // volume discret
      osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime;
      osc.start(t);
      osc.stop(t + 0.07);
    } catch {}
  }, [ensureAudioCtx]);

  // Bip de transition / fin (plus fort)
  const chimeStrong = useCallback(async () => {
    try {
      const ctx = await ensureAudioCtx();
      const make = (freq: number, start: number, dur = 0.18, amp = 1.0) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "triangle"; o.frequency.value = freq;
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(amp, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        o.start(start); o.stop(start + dur + 0.05);
      };
      const now = ctx.currentTime;
      make(1318.51, now + 0.00, 0.18, 1.0);
      make(1760.0,  now + 0.20, 0.20, 1.0);
    } catch {}
  }, [ensureAudioCtx]);

  return { unlock, tick, chimeStrong };
}

/* ---------------- Tabata Timer (compact) ---------------- */
function TabataTimerCompact() {
  const { unlock, tick, chimeStrong } = useAudioChime();

  const [rounds, setRounds] = useState(8);
  const [workSec, setWorkSec] = useState(20);
  const [restSec, setRestSec] = useState(10);

  const [phase, setPhase] = useState<"idle"|"work"|"rest"|"done">("idle");
  const [currRound, setCurrRound] = useState(1);
  const [remaining, setRemaining] = useState(workSec);
  const [running, setRunning] = useState(false);

  const totalSec = useMemo(
    () => rounds * (workSec + restSec) - restSec, // pas de repos après le dernier round
    [rounds, workSec, restSec]
  );

  const elapsedSec = useMemo(() => {
    if (phase === "idle") return 0;
    let elapsed = 0;
    const fullRoundsDone = (currRound - 1);
    elapsed += fullRoundsDone * (workSec + restSec);
    if (phase === "work") elapsed += (workSec - remaining);
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

  // Tick 1s + bips 3-2-1 + bip fort à la fin de phase
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;

        // 3-2-1 avant la fin
        if (next === 3 || next === 2 || next === 1) {
          void tick();
        }

        if (r > 1) return next;

        // r <= 1  → fin de phase
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, currRound, rounds, workSec, restSec]);

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
      {/* Config compacte */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        <label className="label" style={{ fontSize: 12 }}>
          Rounds
          <input className="input" type="number" min={1} max={50} value={rounds}
                 onChange={(e) => setRounds(Math.max(1, Math.min(50, Number(e.target.value) || 0)))}
                 style={{ marginTop: 4, padding: "6px 8px", fontSize: 13 }}/>
        </label>
        <label className="label" style={{ fontSize: 12 }}>
          Travail (s)
          <input className="input" type="number" min={1} max={3600} value={workSec}
                 onChange={(e) => setWorkSec(Math.max(1, Math.min(3600, Number(e.target.value) || 0)))}
                 style={{ marginTop: 4, padding: "6px 8px", fontSize: 13 }}/>
        </label>
        <label className="label" style={{ fontSize: 12 }}>
          Repos (s)
          <input className="input" type="number" min={0} max={3600} value={restSec}
                 onChange={(e) => setRestSec(Math.max(0, Math.min(3600, Number(e.target.value) || 0)))}
                 style={{ marginTop: 4, padding: "6px 8px", fontSize: 13 }}/>
        </label>
      </div>

      {/* Presets rapides */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn" style={{ fontSize: 12 }} onClick={() => { setRounds(8); setWorkSec(20); setRestSec(10);} }>Tabata 8× 20/10</button>
        <button className="btn" style={{ fontSize: 12 }} onClick={() => { setRounds(10); setWorkSec(45); setRestSec(15);} }>10× 45/15</button>
        <button className="btn" style={{ fontSize: 12 }} onClick={() => { setRounds(6); setWorkSec(30); setRestSec(30);} }>6× 30/30</button>
      </div>

      {/* Affichage compteur */}
      <div className="panel" style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
            {phase === "work" ? "Travail" : phase === "rest" ? "Repos" : phase === "done" ? "Terminé" : "Prêt"}
            {phase !== "idle" && phase !== "done" ? ` — Round ${currRound}/${rounds}` : ""}
          </div>
          <div style={{ fontFamily: "tabular-nums", fontWeight: 800, fontSize: 22 }}>
            {String(Math.floor(remaining/60)).padStart(2,"0")}:{String(remaining%60).padStart(2,"0")}
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{ height: 8, background: "#f3f4f6", borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#16a34a" }} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {phase === "idle" || phase === "done" ? (
            <button className="btn btn-dash" style={{ fontSize: 13 }} onClick={start}>Démarrer</button>
          ) : running ? (
            <button className="btn btn-dash" style={{ fontSize: 13 }} onClick={pause}>Pause</button>
          ) : (
            <button className="btn btn-dash" style={{ fontSize: 13 }} onClick={resume}>Reprendre</button>
          )}
          <button className="btn" style={{ fontSize: 13, background: "#ffffff", color: "#111827", border: "1px solid #d1d5db" }} onClick={reset}>
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function MusicPage() {
  const { data: session, status } = useSession();

  // Centrage horizontal
  const PAGE_MAX_WIDTH = 740;   // ajuste si besoin
  const SIDE_PADDING = 16;

  // Réduction du bloc Spotify
  const PLAYER_SCALE = 0.84;
  const invPlayer = 1 / PLAYER_SCALE;

  useEffect(() => {
    if (status === "unauthenticated") signIn("spotify", { callbackUrl: "/dashboard/music" });
  }, [status]);

  if (status === "loading") {
    return (
      <div className="container"
           style={{ paddingTop: 18, paddingBottom: 22, paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, maxWidth: PAGE_MAX_WIDTH, margin: "0 auto" }}>
        <div className="page-header" style={{ marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>Musique</h1>
            <p className="lead" style={{ fontSize: 12, marginTop: 2 }}>Chargement…</p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <article className="card" style={{ padding: 10 }}><div style={{ height: 110, background: "#f3f4f6" }} /></article>
          <article className="card" style={{ padding: 10 }}><div style={{ height: 110, background: "#f3f4f6" }} /></article>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container"
           style={{ paddingTop: 18, paddingBottom: 22, paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, maxWidth: PAGE_MAX_WIDTH, margin: "0 auto" }}>
        <div className="page-header" style={{ marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>Musique</h1>
            <p className="lead" style={{ fontSize: 12, marginTop: 2 }}>Connexion à Spotify requise.</p>
          </div>
        </div>
        <div className="card" style={{ border: "1px solid #d1d5db", background: "#ffffff", padding: 10 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, color: "#374151" }}>Redirection vers Spotify…</div>
            <button className="btn btn-dash" onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })} style={{ fontSize: 13 }}>
              Se connecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container"
         style={{ paddingTop: 18, paddingBottom: 22, paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, maxWidth: PAGE_MAX_WIDTH, margin: "0 auto" }}>
      <div className="page-header" style={{ marginBottom: 6 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>Musique</h1>
          <p className="lead" style={{ fontSize: 12, marginTop: 2 }}>
            Minuteur Tabata + lecteur Spotify.
          </p>
        </div>
        <div>
          <button onClick={() => signOut({ callbackUrl: "/dashboard/music" })} className="btn btn-dash" title="Se déconnecter" style={{ fontSize: 13 }}>
            ⏻ Se déconnecter
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* —— Carte Timer */}
        <article className="card" style={{ padding: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h3 style={{ marginTop: 0, fontSize: 16, color: "#111827", fontWeight: 800 }}>Timer</h3>

            {/* Bouton Tabata — texte noir */}
            <button
              type="button"
              className="btn"
              style={{
                fontSize: 12,
                padding: "6px 10px",
                background: "#ffffff",
                color: "#111827", // texte noir
                border: "1px solid #d1d5db",
                borderRadius: 999,
                fontWeight: 600,
              }}
              onClick={() => {
                const el = document.getElementById("tabata-root");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Tabata
            </button>
          </div>

          <div id="tabata-root" style={{ marginTop: 8 }}>
            <TabataTimerCompact />
          </div>
        </article>

        {/* —— Carte Spotify */}
        <article className="card" style={{ padding: 10 }}>
          <h3 style={{ marginTop: 0, fontSize: 14, color: "#111827" }}>Lecteur Spotify</h3>
          <div className="text-sm" style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
            Contrôle du lecteur connecté à ton compte.
          </div>
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
        </article>
      </div>
    </div>
  );
}
