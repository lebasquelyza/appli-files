"use client";
import { useEffect, useRef, useState } from "react";

const btn = "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 active:translate-y-px transition dark:text-white dark:bg-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800";

export default function Chrono() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running]);

  const reset = () => setSeconds(0);
  const toggle = () => setRunning((r) => !r);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const fmt = [h, m, s].map(v => String(v).padStart(2, "0")).join(":");

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div className="text-3xl font-mono text-center">{fmt}</div>
      <div className="flex gap-2 justify-center">
        <button onClick={toggle} className={btn}>{running ? "Pause" : "Démarrer"}</button>
        <button onClick={reset} className={btn}>Réinitialiser</button>
      </div>
    </div>
  );
}
