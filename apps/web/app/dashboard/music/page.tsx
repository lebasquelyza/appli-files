"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

// ↓↓↓ AJOUTS MINIMAUX ↓↓↓
import { useEffect, useRef, useState } from "react";
// ↑↑↑ AJOUTS MINIMAUX ↑↑↑

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  // ↓↓↓ AJOUTS MINIMAUX : audio + observation du Timer ↓↓↓
  const [audioReady, setAudioReady] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerHostRef = useRef<HTMLDivElement | null>(null);
  const timerActiveRef = useRef(false); // on a vu >0s (minuteur lancé)
  const hasBeepedRef = useRef(false);   // éviter les doubles bips

  const ensureAudioCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  // petit chime "exercice fini" (double note courte)
  const playFinishChime = async () => {
    const ctx = await ensureAudioCtx();
    const makeNote = (freq: number, start: number, dur = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.7, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    };
    const now = ctx.currentTime;
    makeNote(1318.51, now + 0.00, 0.18); // E6
    makeNote(1760.0,  now + 0.20, 0.20); // A6
  };

  // Débloque l'audio à la 1ère interaction (nécessaire sur mobile/iOS)
  useEffect(() => {
    const onFirstInteraction = async () => {
      try {
        await ensureAudioCtx();
        setAudioReady(true);
      } finally {
        window.removeEventListener("click", onFirstInteraction);
        window.removeEventListener("touchstart", onFirstInteraction);
        window.removeEventListener("keydown", onFirstInteraction);
      }
    };
    window.addEventListener("click", onFirstInteraction, { passive: true });
    window.addEventListener("touchstart", onFirstInteraction, { passive: true });
    window.addEventListener("keydown", onFirstInteraction);
    return () => {
      window.removeEventListener("click", onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, []);

  // Observe le rendu du Timer : arme dès qu'on voit >0s, bip une fois à 0s
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;

    const obs = new MutationObserver(() => {
      if (!audioReady) return;
      const txt = host.innerText || "";
      const hasPositive = /\b([1-9]\d*)s\b/.test(txt);
      const atZero = /\b0s\b/.test(txt);

      if (hasPositive) {                // un minuteur a été lancé
        timerActiveRef.current = true;
        hasBeepedRef.current = false;   // prêt pour la fin
      }
      if (timerActiveRef.current && !hasBeepedRef.current && atZero) {
        hasBeepedRef.current = true;    // bip une seule fois
        timerActiveRef.current = false; // attendre un nouveau départ
        void playFinishChime();
      }
    });

    obs.observe(host, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [audioReady]);
  // ↑↑↑ AJOUTS MINIMAUX ↑↑↑

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

      {/* Minuteur (espacé) */}
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

