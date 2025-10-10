"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Chargement client-only
const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const timerHostRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const lastSecRef = useRef<number | null>(null);
  const countingDownRef = useRef(false);
  const hasBeepedRef = useRef(false);

  // ✅ Protection d'accès — redirige vers login si pas connecté
  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("spotify", { callbackUrl: "/dashboard/music" });
    }
  }, [status]);

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

  if (status === "loading") {
    return <main className="p-6">Chargement…</main>;
  }

  // ✅ On n'affiche la page que si connecté
  if (!session) {
    return <main className="p-6">Redirection vers Spotify…</main>;
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Musique</h1>
        <button
          onClick={() => signOut({ callbackUrl: "/dashboard/music" })}
          className="btn-dash"
          title="Se déconnecter"
        >
          ⏻ Se déconnecter
        </button>
      </div>

      <div ref={timerHostRef}>
        <Timer />
      </div>

      <SpotifyPlayer />
    </main>
  );
}
