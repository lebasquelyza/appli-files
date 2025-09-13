"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

// ✅ AJOUTS MINIMAUX
import { useEffect, useRef } from "react";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  // ✅ AJOUTS : refs pour surveiller le Timer et jouer le son UNIQUEMENT à la fin
  const timerHostRef = useRef<HTMLDivElement | null>(null);
  const lastSecRef = useRef<number | null>(null);  // dernière valeur (en s)
  const countingDownRef = useRef(false);           // a réellement commencé à décrémenter
  const hasBeepedRef = useRef(false);              // éviter double son

  // Parse le texte du Timer en secondes (supporte "30s" et "MM:SS")
  const parseSeconds = (txt: string): number | null => {
    const mS = txt.match(/(\d+)\s*s\b/); // "30s"
    if (mS) return parseInt(mS[1], 10);
    const mMS = txt.match(/\b(\d{1,2}):(\d{2})\b/); // "MM:SS"
    if (mMS) return parseInt(mMS[1], 10) * 60 + parseInt(mMS[2], 10);
    return null;
  };

  // 🔔 Son “exercice fini” — créé et joué *uniquement* à 0s
  const playFinishChime = async () => {
    // ⚠️ L’AudioContext n’est créé qu’ici (à la fin)
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    const ctx: AudioContext = new Ctx();

    const makeNote = (freq: number, start: number, dur = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";         // chime clair/agréable
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
    // petite double note “fini”
    makeNote(1318.51, now + 0.00, 0.18); // E6
    makeNote(1760.0,  now + 0.20, 0.20); // A6
  };

  // Observe le Timer :
  // - attend une vraie décrémentation (ex: 30→29) pour activer countingDown
  // - déclenche le son *une seule fois* quand on atteint 0s
  // - se réarme si un nouveau cycle repart (>0)
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

      // vraie descente détectée (minuteur effectivement en cours)
      if (last != null && curr < last && curr > 0) {
        countingDownRef.current = true;
        hasBeepedRef.current = false; // prêt à biper à 0
      }

      // jouer le son uniquement à la fin, si on a bien compté à rebours
      if (countingDownRef.current && !hasBeepedRef.current && curr === 0) {
        hasBeepedRef.current = true;
        countingDownRef.current = false;
        void playFinishChime();
      }

      // si ça repart (>0) après une fin, on se réarme pour un nouveau cycle
      if (curr > 0 && hasBeepedRef.current) {
        // on attendra à nouveau une vraie décrémentation
        countingDownRef.current = false;
      }

      lastSecRef.current = curr;
    });

    obs.observe(host, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, []);
  // ✅ FIN AJOUTS

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

      {/* Minuteur (espacé) — simplement wrappé pour l’observer */}
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
