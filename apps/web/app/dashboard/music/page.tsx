"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();

  // --- Refs pour observer le Timer & gérer l'audio ---
  const timerHostRef = useRef<HTMLDivElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);   // déverrouillé par geste DANS le Timer

  const lastSecRef = useRef<number | null>(null); // dernière valeur parsée
  const countingDownRef = useRef(false);          // on a vu au moins une décrémentation
  const hasBeepedRef = useRef(false);             // éviter double son

  // --- Création/résumé de l'AudioContext ---
  const ensureAudioCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  // --- Hack iOS: jouer un "silence" pour déverrouiller l'audio ---
  const unlockAudioWithSilence = async () => {
    try {
      const ctx = await ensureAudioCtx();
      const buffer = ctx.createBuffer(1, 1, 22050); // 1 frame silencieux
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
  };

  // --- Chime de fin (double note claire et brève) ---
  const playFinishChime = async () => {
    try {
      const ctx = await ensureAudioCtx();

      const makeNote = (freq: number, start: number, dur = 0.18) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle"; // timbre clair/agréable
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);

        // enveloppe courte et audible
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.85, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.start(start);
        osc.stop(start + dur + 0.05);
      };

      const now = ctx.currentTime;
      makeNote(1318.51, now + 0.00, 0.18); // E6
      makeNote(1760.0,  now + 0.20, 0.20); // A6
    } catch {}
  };

  // --- Parse le texte affiché par le Timer en secondes ---
  const parseSeconds = (txt: string): number | null => {
    const t = txt.replace(/\u00A0/g, " ").trim(); // remplace espaces insécables

    // 1) Formats 0, 0s, 0 s
    const mZero = t.match(/\b0\s*s?\b/);
    if (mZero) return 0;

    // 2) Format "30s" ou "30 s" ou "123 s"
    const mS = t.match(/\b(\d+)\s*s\b/);
    if (mS) return parseInt(mS[1], 10);

    // 3) Format "MM:SS" (ex: 01:23, 9:05)
    const mMS = t.match(/\b(\d{1,2}):(\d{2})\b/);
    if (mMS) {
      const mm = parseInt(mMS[1], 10);
      const ss = parseInt(mMS[2], 10);
      return mm * 60 + ss;
    }

    // 4) Nombre isolé (ex: "25")
    const mNum = t.match(/\b(\d+)\b/);
    if (mNum) return parseInt(mNum[1], 10);

    return null;
  };

  // --- Déverrouiller l'audio UNIQUEMENT dans la zone du Timer ---
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;

    const unlock = async () => {
      if (audioUnlockedRef.current) return;
      await unlockAudioWithSilence();     // iOS-friendly
      audioUnlockedRef.current = true;    // => on pourra jouer à 0s
    };

    // utiliser pointerdown pour capter clic/touch
    host.addEventListener("pointerdown", unlock, { passive: true });
    host.addEventListener("keydown", unlock); // si Timer a un input/boutons focusables

    return () => {
      host.removeEventListener("pointerdown", unlock);
      host.removeEventListener("keydown", unlock);
    };
  }, []);

  // --- Observer le Timer & déclencher son à 0s après vraie décrémentation ---
  useEffect(() => {
    const host = timerHostRef.current;
    if (!host) return;

    // Reset sécurité à l'attachement
    lastSecRef.current = null;
    countingDownRef.current = false;
    hasBeepedRef.current = false;

    // MutationObserver (réagit aux changements de texte)
    const obs = new MutationObserver(() => {
      const txt = host.innerText || "";
      const curr = parseSeconds(txt);
      if (curr == null) return;

      const last = lastSecRef.current;

      // Détection d'une vraie décrémentation (ex: 30 -> 29)
      if (last != null && curr < last && curr > 0) {
        countingDownRef.current = true;
        hasBeepedRef.current = false;
      }

      // Son UNIQUEMENT quand: décrémentation vue + 0s + audio déverrouillé
      if (countingDownRef.current && !hasBeepedRef.current && curr === 0 && audioUnlockedRef.current) {
        hasBeepedRef.current = true;
        countingDownRef.current = false;
        void playFinishChime();
      }

      // Si un nouveau cycle repart (>0) après une fin
      if (curr > 0 && hasBeepedRef.current) {
        countingDownRef.current = false; // on attendra une nouvelle décrémentation
      }

      lastSecRef.current = curr;
    });

    obs.observe(host, { subtree: true, childList: true, characterData: true });

    // Fallback: petit polling toutes les 250ms au cas où le Timer n'update pas le DOM textuel
    const poll = setInterval(() => {
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
      if (curr > 0 && hasBeepedRef.current) {
        countingDownRef.current = false;
      }

      lastSecRef.current = curr;
    }, 250);

    return () => {
      obs.disconnect();
      clearInterval(poll);
    };
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

      {/* Minuteur (espacé) — wrappé pour l’observer & déverrouiller l’audio */}
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
