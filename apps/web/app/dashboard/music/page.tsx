"use client";
import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();
  const [audioReady, setAudioReady] = useState(false);

  // --- Web Audio pour le bip (dans cette page) ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ensureAudioCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };
  const playBeep = async (duration = 0.3, freq = 880) => {
    try {
      const ctx = await ensureAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch {
      /* ignore */
    }
  };

  // --- Observe le DOM du Timer pour détecter "0s" ---
  const timerHostRef = useRef<HTMLDivElement | null>(null);
  const hasBeepedRef = useRef(false);
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;

    const obs = new MutationObserver(() => {
      if (!audioReady) return; // évite les blocages auto-play
      const txt = host.innerText || "";
      // déclenche si on voit "0s" et on ne l'a pas encore fait
      if (!hasBeepedRef.current && /\b0s\b/.test(txt)) {
        hasBeepedRef.current = true;
        // 2 petits bips pour être bien audible
        playBeep();
        setTimeout(() => playBeep(), 200);
      }
      // si on repart au-dessus de 0, on réarme
      if (hasBeepedRef.current && /\b([1-9]\d*)s\b/.test(txt)) {
        hasBeepedRef.current = false;
      }
    });

    obs.observe(host, { subtree: true, characterData: true, childList: true });
    return () => obs.disconnect();
  }, [audioReady]);

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

      {/* Bouton pour autoriser/tester le son */}
      <div className="flex items-center gap-3">
        <button
          className="btn-dash"
          title="Tester le bip"
          onClick={async () => {
            await ensureAudioCtx();
            setAudioReady(true);
            playBeep();
          }}
        >
          🔊 Tester le bip
        </button>
        {!audioReady && <span className="text-sm" style={{ color: "var(--muted)" }}>
          (Clique ici une fois pour autoriser l’audio)
        </span>}
      </div>

      {/* Minuteur (espacé) — observé par MutationObserver */}
      <div ref={timerHostRef}>
        <Timer />
      </div>

      {/* Player visible uniquement si connecté */}
      {session ? <SpotifyPlayer /> : (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Connecte ton compte Spotify pour utiliser le lecteur.
        </p>
      )}
    </main>
  );
}
