"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
// ✅ AJOUTS
import { useEffect, useRef } from "react";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  // ✅ Refs pour gérer le son UNIQUEMENT à la fin du minuteur
  const timerHostRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);     // devient true après un geste DANS le Timer
  const lastSecRef = useRef<number | null>(null);
  const countingDownRef = useRef(false);      // vraie décrémentation observée
  const hasBeepedRef = useRef(false);         // éviter double son

  // Déverrouille l’audio (sans jouer de son)
  const ensureAudioCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  // Son “exercice fini” (double chime bref)
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
        gain.gain.linearRampToValueAtTime(0.75, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start);
        osc.stop(start + dur + 0.05);
      };
      const now = ctx.currentTime;
      makeNote(1318.51, now + 0.00, 0.18); // E6
      makeNote(1760.0,  now + 0.20, 0.20); // A6
    } catch {
      /* ignore */
    }
  };

  // Parse le texte du Timer en secondes ("30s" ou "MM:SS")
  const parseSeconds = (txt: string): number | null => {
    const mS = txt.match(/(\d+)\s*s\b/);
    if (mS) return parseInt(mS[1], 10);
    const mMS = txt.match(/\b(\d{1,2}):(\d{2})\b/);
    if (mMS) return parseInt(mMS[1], 10) * 60 + parseInt(mMS[2], 10);
    return null;
  };

  // 1) Déverrouiller l’audio uniquement sur interaction DANS le Timer
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;

    const unlock = async () => {
      if (audioUnlockedRef.current) return;
      try {
        await ensureAudioCtx();
        audioUnlockedRef.current = true; // audio autorisé, mais on ne joue rien ici
      } catch {}
    };

    host.addEventListener("click", unlock);
    host.addEventListener("touchstart", unlock, { passive: true });
    host.addEventListener("keydown", unlock);

    return () => {
      host.removeEventListener("click", unlock);
      host.removeEventListener("touchstart", unlock);
      host.removeEventListener("keydown", unlock);
    };
  }, []);

  // 2) Observer le Timer: détecter vraie descente puis jouer à 0s (une seule fois)
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;

    // reset sécurité
    lastSecRef.current = null;
    countingDownRef.current = false;
    hasBeepedRef.current = false;

    const obs = new MutationObserver(() => {
      const txt = host.innerText || "";
      const curr = parseSeconds(txt);
      if (curr == null) return;

      const last = lastSecRef.current;

      // vraie décrémentation (ex: 30 -> 29) => le minuteur est bien lancé
      if (last != null && curr < last && curr > 0) {
        countingDownRef.current = true;
        hasBeepedRef.current = false;
      }

      // jouer UNIQUEMENT à 0s si:
      // - le minuteur a décrémenté
      // - l’audio a été déverrouillé par un geste dans le Timer
      if (countingDownRef.current && !hasBeepedRef.current && curr === 0 && audioUnlockedRef.current) {
        hasBeepedRef.current = true;
        countingDownRef.current = false;
        void playFinishChime();
      }

      // si un nouveau cycle repart (>0), on se réarme
      if (curr > 0 && hasBeepedRef.current) {
        countingDownRef.current = false;
      }

      lastSecRef.current = curr;
    });

    obs.observe(host, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, []);

  if (status === "loading") return <main className="p-6">Chargement…</main>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lecteur Spotify</h1>
        {session ? (
          <button onClick={() => signOut({ callbackUrl: "/dashboard/music" })} className="btn-dash" title="Se déconnecter">⏻ Se déconnecter</button>
        ) : (
          <button onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })} className="btn-dash" title="Se connecter">🔗 Se connecter</button>
        )}
      </div>

      {/* Minuteur (espacé) — simplement wrappé pour l’observer et déverrouiller l’audio */}
      <div ref={timerHostRef}>
        <Timer />
      </div>

      {/* Player visible uniquement si connecté */}
      {session ? <SpotifyPlayer /> : (
        <p className="text-sm" style={{color:"var(--muted)"}}>
          Connecte ton compte Spotify pour utiliser le lecteur.
        </p>
      )}
    </main>
  );
}
