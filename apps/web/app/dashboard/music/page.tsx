"use client";
import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  // --- État/refs audio & observation ---
  const [audioReady, setAudioReady] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerHostRef = useRef<HTMLDivElement | null>(null);
  const hasBeepedRef = useRef(false);

  // --- Web Audio: bip court, fort, très audible ---
  const ensureAudioCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playShortBeep = async (freq = 1400, dur = 0.18) => {
    const ctx = await ensureAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";          // plus percutant
    osc.frequency.value = freq;   // aigu = bien audible
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.65, now + 0.01); // assez fort
    gain.gain.linearRampToValueAtTime(0.0001, now + dur);

    osc.start(now);
    osc.stop(now + dur + 0.05);
  };

  const playDoubleBeep = async () => {
    try {
      await playShortBeep(1400, 0.18);
      setTimeout(() => { void playShortBeep(1200, 0.16); }, 120); // second bip un poil plus grave
    } catch {}
  };

  // --- Déblocage audio AUTOMATIQUE à la 1ère interaction (pas de bouton) ---
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

  // --- Observe le Timer: bip une seule fois à 0s, se réarme si >0s ---
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;

    const obs = new MutationObserver(() => {
      if (!audioReady) return; // attend la 1ère interaction utilisateur
      const txt = host.innerText || "";

      // déclenche exactement à 0s, une seule fois
      if (!hasBeepedRef.current && /\b0s\b/.test(txt)) {
        hasBeepedRef.current = true;
        void playDoubleBeep();
      }
      // si le minuteur repart (nouveau cycle), on réarme
      if (hasBeepedRef.current && /\b([1-9]\d*)s\b/.test(txt)) {
        hasBeepedRef.current = false;
      }
    });

    obs.observe(host, { subtree: true, childList: true, characterData: true });
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

      {/* Minuteur (espacé) — observé pour détecter 0s */}
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
