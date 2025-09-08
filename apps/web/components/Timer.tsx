"use client";
import { useEffect, useRef, useState } from "react";

const btn = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition active:translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-0";
const btnPrimary = `${btn} text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 focus:ring-indigo-400`;
const btnMuted = `${btn} text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-gray-300 dark:text-white dark:bg-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800`;
const card = "rounded-2xl border border-gray-200/80 bg-white/70 backdrop-blur p-4 dark:bg-neutral-900/70 dark:border-neutral-800";

export default function Timer() {
  const [minutes, setMinutes] = useState<number>(1);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [running, setRunning] = useState(false);
  const initialRef = useRef<number>(60);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // mettre à jour secondsLeft si on change les minutes à l'arrêt
    if (!running) {
      const s = Math.max(0, Math.floor(minutes * 60));
      setSecondsLeft(s);
      initialRef.current = s || 1; // éviter div/0
    }
  }, [minutes, running]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running]);

  const toggle = () => setRunning((r) => !r);
  const reset = () => {
    setRunning(false);
    setSecondsLeft(initialRef.current);
  };

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const fmt = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const progress = 1 - Math.min(1, Math.max(0, secondsLeft / (initialRef.current || 1)));

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Durée (min)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={minutes}
            disabled={running}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-20 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:bg-neutral-900 dark:border-neutral-700"
          />
        </div>
        <div className="text-3xl font-mono tabular-nums">{fmt}</div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-800">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-[width]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={toggle} className={btnPrimary}>
          {running ? "Pause" : "Démarrer"}
        </button>
        <button onClick={reset} className={btnMuted}>Réinitialiser</button>
      </div>
    </div>
  );
}
