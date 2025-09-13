"use client";
import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  // ---- Audio + Observation ----
  const [audioReady, setAudioReady] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerHostRef = useRef<HTMLDivElement | null>(null);

  // Vrai dès qu'on a vu le timer passer par >0s (donc "lancé")
  const timerActiveRef = useRef(false);
  // Anti-doublon : bip une seule fois par fin de cycle
  const hasBeepedRef = useRef(false);

  // AudioContext réutilisable (débloqué à la 1ère interaction)
  const ensureAudioCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  // Chime “exercice fini” : deux notes brèves (clair/agréable)
  const playFinishChime = async () => {
    const ctx = await ensureAudioCtx();

    const makeNote = (freq: number, start: number, dur = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";               // timbre clair, type "cloche"
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Enveloppe courte
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.7, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    const now = ctx.currentTime;
    // Deux notes: E6 puis A6 (effet "fini")
    makeNote(1318.51, now + 0.00, 0.18); // E6
    makeNote(1760.0,  now + 0.20, 0.20); // A6
  };

  // Observe le DOM du Timer :
  // - "arme" le bip dès qu'on voit >0s (donc un minuteur a été lancé)
  // - déclenche un seul chime à 0s si le minuteur a été lancé
  // - se réarme tout seul quand on revoit >0s (nouveau départ)
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;

    const obs = new MutationObserver(() => {
      if (!audioReady) return;

      const txt = host.innerText || "";
      const hasPositive = /\b([1-9]\d*)s\b/.test(txt);
      const atZero = /\b0s\b/.test(txt);

      // Un minuteur a été démarré si on a vu >0s
      if (hasPositive) {
        timerActiveRef.current = true;
        hasBeepedRef.current = false; // prêt pour la fin
      }

      // Joue le chime une seule fois quand on atteint 0s après un départ
      if (timerActiveRef.current && !hasBeepedRef.current && atZero) {
        hasBeepedRef.current = true;
        timerActiveRef.current = false; // évite tout rebip jusqu'à nouveau départ
        void playFinishChime();
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
          <button onClick={() => signOut({ callbackUrl: "/dashboard/music" })} className="btn-dash" title="Se déconnecter">
            ⏻ Se déconnecter
          </button>
        ) : (
          <button onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })} className="btn-dash" title="Se connecter">
            🔗 Se connecter
          </button>
        )}
      </div>

      {/* Minuteur (espacé) — observé pour détecter le passage à 0s */}
      <div ref={timerHostRef}>
        <Timer />
      </div>

      {/* Player visible uniquement si connecté */}
      {session ? (
        <SpotifyPlayer />
      ) : (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Connecte ton compte Spotify pour utiliser le lecteur.
        </p>
      )}
    </main>
  );
}
