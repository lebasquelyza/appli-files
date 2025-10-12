"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

// Client-only
const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  const timerHostRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const lastSecRef = useRef<number | null>(null);
  const countingDownRef = useRef(false);
  const hasBeepedRef = useRef(false);

  /* ---------- Auth gate ---------- */
  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("spotify", { callbackUrl: "/dashboard/music" });
    }
  }, [status]);

  /* ---------- Audio utils ---------- */
  const ensureAudioCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const unlockAudioWithSilence = async () => {
    try {
      const ctx = await ensureAudioCtx();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
  };

  const playFinishChime = async () => {
    try {
      const ctx = await ensureAudioCtx();
      const makeNote = (freq: number, start: number, dur = 0.18) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.85, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start);
        osc.stop(start + dur + 0.05);
      };
      const now = ctx.currentTime;
      makeNote(1318.51, now + 0.00);
      makeNote(1760.0, now + 0.20);
    } catch {}
  };

  const parseSeconds = (txt: string): number | null => {
    const t = txt.replace(/\u00A0/g, " ").trim();
    const mZero = t.match(/\b0\s*s?\b/);
    if (mZero) return 0;
    const mS = t.match(/\b(\d+)\s*s\b/);
    if (mS) return parseInt(mS[1], 10);
    const mMS = t.match(/\b(\d{1,2}):(\d{2})\b/);
    if (mMS) return parseInt(mMS[1], 10) * 60 + parseInt(mMS[2], 10);
    const mNum = t.match(/\b(\d+)\b/);
    if (mNum) return parseInt(mNum[1], 10);
    return null;
  };

  /* ---------- Déverrouillage audio au premier input ---------- */
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;
    const unlock = async () => {
      if (audioUnlockedRef.current) return;
      await unlockAudioWithSilence();
      audioUnlockedRef.current = true;
    };
    host.addEventListener("pointerdown", unlock, { passive: true });
    host.addEventListener("keydown", unlock);
    return () => {
      host.removeEventListener("pointerdown", unlock);
      host.removeEventListener("keydown", unlock);
    };
  }, []);

  /* ---------- Observe Timer pour bip à 0 ---------- */
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;
    lastSecRef.current = null;
    countingDownRef.current = false;
    hasBeepedRef.current = false;

    const onTick = () => {
      const txt = host.innerText || "";
      const curr = parseSeconds(txt);
      if (curr == null) return;
      const last = lastSecRef.current;

      if (last != null && curr < last && curr > 0) {
        countingDownRef.current = true;
        hasBeepedRef.current = false;
      }
      if (countingDownRef.current && !hasBeepedRef.current && curr === 0 && audioUnlockedRef.current) {
        hasBeepedRef.current = true;
        countingDownRef.current = false;
        void playFinishChime();
      }
      if (curr > 0 && hasBeepedRef.current) countingDownRef.current = false;
      lastSecRef.current = curr;
    };

    const obs = new MutationObserver(onTick);
    obs.observe(host, { subtree: true, childList: true, characterData: true });
    const poll = setInterval(onTick, 250);
    return () => {
      obs.disconnect();
      clearInterval(poll);
    };
  }, []);

  /* ---------- États de page au même style que /calories ---------- */
  if (status === "loading") {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="page-header" style={{ marginBottom: 8 }}>
          <div>
            <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>Musique</h1>
            <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>Chargement…</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="card"><div style={{ height: 140, background: "#f3f4f6" }} /></article>
          <article className="card"><div style={{ height: 140, background: "#f3f4f6" }} /></article>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="page-header" style={{ marginBottom: 8 }}>
          <div>
            <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>Musique</h1>
            <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>Connexion à Spotify requise.</p>
          </div>
        </div>
        <div className="card" style={{ border: "1px solid #d1d5db", background: "#ffffff" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, color: "#374151" }}>Redirection vers Spotify…</div>
            <button className="btn btn-dash" onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })} style={{ fontSize: 14 }}>
              Se connecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Page ---------- */
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>Musique</h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            Minuteur + lecteur Spotify, avec sonnerie à la fin.
          </p>
        </div>
        <div>
          <button
            onClick={() => signOut({ callbackUrl: "/dashboard/music" })}
            className="btn btn-dash"
            title="Se déconnecter"
            style={{ fontSize: 14 }}
          >
            ⏻ Se déconnecter
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timer */}
        <article className="card">
          <h3 style={{ marginTop: 0, fontSize: 16, color: "#111827" }}>Timer</h3>
          <div className="text-sm" style={{ color: "#6b7280", fontSize: 14, marginTop: 2 }}>
            La sonnerie se déclenche quand le compteur atteint 0.
          </div>
          <div
            ref={timerHostRef}
            tabIndex={0}
            style={{ marginTop: 12, outline: "none" }}
          >
            <Timer />
          </div>
        </article>

        {/* Spotify Player */}
        <article className="card">
          <h3 style={{ marginTop: 0, fontSize: 16, color: "#111827" }}>Lecteur Spotify</h3>
          <div className="text-sm" style={{ color: "#6b7280", fontSize: 14, marginTop: 2 }}>
            Contrôle du lecteur connecté à ton compte.
          </div>
          <div style={{ marginTop: 12 }}>
            <SpotifyPlayer />
          </div>
        </article>
      </div>
    </div>
  );
}
