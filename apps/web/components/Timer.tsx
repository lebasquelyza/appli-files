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

  // Bip court à la fin
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

  // Recalcule le total à l'arrêt
  useEffect(() => {
    if (!running) {
      const total = Math.max(0, Math.floor(minutes * 60) + secAdd);
      setSecondsLeft(total);
      initialRef.current = total || 1;
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
    <div
      className="p-4 rounded-[14px] space-y-4"
      style={{
        background: "var(--bg)",
        border: "1px solid rgba(0,0,0,.08)",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* Ligne de réglages */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm" style={{color:"var(--muted)"}}>Durée</label>
          <input
            type="number" min={0} step={1}
            value={minutes}
            disabled={running}
            onChange={(e) => setMinutes(clamp(Number(e.target.value || 0), 0, 600))}
            className="w-24 rounded-[12px] px-3 py-2 text-sm"
            style={{
              background:"var(--bg)",
              border:"1px solid rgba(0,0,0,.12)",
              color:"var(--text)"
            }}
          />
          <span className="text-sm" style={{color:"var(--muted)"}}>min</span>

          {/* Ajout de secondes : +0/+15/+30/+45 (désaturé) */}
          <div
            className="inline-flex gap-1 p-1 rounded-[12px]"
            style={{ background:"var(--panel)", border:"1px solid rgba(0,0,0,.06)" }}
          >
            {[0,15,30,45].map(v => (
              <button
                key={v}
                type="button"
                disabled={running}
                onClick={() => setSecAdd(v as 0|15|30|45)}
                style={{
                  padding:".42rem .6rem",
                  borderRadius:"10px",
                  fontWeight:600,
                  fontSize:".85rem",
                  color: v===secAdd ? "#fff" : "var(--muted)",
                  background: v===secAdd ? "linear-gradient(90deg,var(--brand),var(--brand2))" : "transparent",
                  boxShadow: v===secAdd ? "var(--shadow)" : "none",
                  transition:"filter .15s ease, transform .1s ease",
                }}
              >
                +{v}s
              </button>
            ))}
          </div>
        </div>

        {/* Temps très visible */}
        <div
          className="font-mono font-semibold tabular-nums text-center"
          style={{ fontSize:"56px", lineHeight:1, letterSpacing:"0.01em" }}
        >
          {fmt}
        </div>
      </div>

      {/* Presets discrets */}
      <div className="flex flex-wrap gap-2">
        {[{t:30,l:"30s"},{t:90,l:"1:30"},{t:180,l:"3:00"}].map(p => (
          <button
            key={p.t}
            type="button"
            disabled={running}
            onClick={() => applyPreset(p.t)}
            className="chip"
            style={{
              background:"var(--panel)",
              color:"var(--text)",
              border:"1px solid rgba(0,0,0,.06)",
              borderRadius:"var(--radius)",
              padding:".45rem .7rem",
              fontWeight:600,
              fontSize:".85rem"
            }}
          >
            {p.l}
          </button>
        ))}
      </div>

      {/* Barre de progression sobre */}
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background:"rgba(0,0,0,.06)" }}>
        <div
          className="h-full transition-[width]"
          style={{
            width: `${progress * 100}%`,
            backgroundImage:"linear-gradient(90deg,var(--brand),var(--brand2))",
            filter:"saturate(.85)",
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
