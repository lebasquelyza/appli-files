"use client";
import { useEffect, useRef, useState } from "react";

function clamp(n:number, min:number, max:number){ return Math.max(min, Math.min(max, n)); }

export default function Timer() {
  const [minutes, setMinutes] = useState<number>(1);
  const [secAdd, setSecAdd] = useState<0|15|30|45>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [running, setRunning] = useState(false);
  const initialRef = useRef<number>(60);
  const intervalRef = useRef<number | null>(null);

  // beep court à la fin
  function beep(duration = 250, frequency = 900, volume = 0.25) {
    try {
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.value = volume;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, duration);
    } catch {}
  }

  // Recalcule le total quand minutes/secAdd changent (à l'arrêt)
  useEffect(() => {
    if (!running) {
      const total = Math.max(0, Math.floor(minutes * 60) + secAdd);
      setSecondsLeft(total);
      initialRef.current = total || 1; // éviter division par 0
    }
  }, [minutes, secAdd, running]);

  // Tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          beep();
          if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
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
  const reset = () => { setRunning(false); setSecondsLeft(initialRef.current); };

  // Presets (définissent minutes + secAdd)
  function applyPreset(totalSeconds:number){
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60 as 0|15|30|45;
    setMinutes(m);
    setSecAdd((s === 15 || s === 30 || s === 45 ? s : 0) as 0|15|30|45);
  }

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const fmt = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const progress = 1 - Math.min(1, Math.max(0, secondsLeft / (initialRef.current || 1)));

  return (
    <div className="panel p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{color:"var(--muted)"}}>Durée</label>
          <input
            type="number" min={0} step={1}
            value={minutes}
            disabled={running}
            onChange={(e) => setMinutes(clamp(Number(e.target.value || 0), 0, 600))}
            className="w-24 rounded-xl px-3 py-2 text-sm"
            style={{
              background:"var(--bg)", border:"1px solid rgba(0,0,0,.12)", color:"var(--text)",
            }}
          />
          <span className="text-sm" style={{color:"var(--muted)"}}>min</span>
          {/* segmented: +0/+15/+30/+45 */}
          <div className="seg">
            {[0,15,30,45].map(v => (
              <button
                key={v}
                type="button"
                className={v===secAdd ? "active" : ""}
                disabled={running}
                onClick={() => setSecAdd(v as 0|15|30|45)}
              >
                +{v}s
              </button>
            ))}
          </div>
        </div>
        <div className="text-4xl font-mono tabular-nums">{fmt}</div>
      </div>

      {/* Presets */}
      <div className="chips">
        <button type="button" className="chip" disabled={running} onClick={() => applyPreset(30)}>30s</button>
        <button type="button" className="chip" disabled={running} onClick={() => applyPreset(90)}>1:30</button>
        <button type="button" className="chip" disabled={running} onClick={() => applyPreset(180)}>3:00</button>
      </div>

      {/* Barre de progression */}
      <div className="h-2 w-full overflow-hidden rounded-full" style={{background:"var(--panel)"}}>
        <div
          className="h-full transition-[width]"
          style={{
            width: `${progress * 100}%`,
            backgroundImage:`linear-gradient(90deg,var(--brand),var(--brand2))`,
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={toggle} className="btn-dash">
          {running ? "Pause" : "Démarrer"}
        </button>
        <button onClick={reset} className="btn-dash">Réinitialiser</button>
      </div>
    </div>
  );
}
