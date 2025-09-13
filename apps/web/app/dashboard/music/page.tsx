"use client";
import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const SpotifyPlayer = dynamic(() => import("@/components/SpotifyPlayer"), { ssr: false });
const Timer = dynamic(() => import("@/components/Timer"), { ssr: false });

export default function MusicPage() {
  const { data: session, status } = useSession();
  const [audioReady, setAudioReady] = useState(false);

  // --- Web Audio pour bip court et fort ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ensureAudioCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playBeep = async () => {
    try {
      const ctx = await ensureAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square"; // son plus tranchant qu’un sine
      osc.frequency.value = 1200; // fréquence plus aiguë

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.01); // monte vite
      gain.gain.linearRampToValueAtTime(0.001, now + 0.2); // redescend après 200ms

      osc.start(now);
      osc.stop(now + 0.25); // court
    } catch {
      /* ignore */
    }
  };

  // --- Observer le Timer et déclencher bip UNE SEULE FOIS ---
  const timerHostRef = useRef<HTMLDivElement | null>(null);
  const hasBeepedRef = useRef(false);

  useEffect(() => {
    const host = timerHostRef.curren
