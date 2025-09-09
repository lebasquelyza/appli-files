"use client";
import { useEffect, useRef, useState } from "react";

function clamp(n:number, min:number, max:number){ return Math.max(min, Math.min(max, n)); }

export default function Timer() {
  // Réglages
  const [minutes, setMinutes] = useState<number>(1);
  const [secAdd, setSecAdd] = useState<0|15|30|45>(0);
  // État
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

  // Recalcule le total quand on modifie minutes/secondes (si à l'arrêt)
  useEffect(() => {
    if (!running) {
      const total = Math.max(0, Math.floor(minutes * 60) + secAdd);
      setSecondsLeft(total);
      initialRef.current = total || 1; // éviter division par 0
    }
  }, [minutes, secAdd, running]);

  // Tick 1s
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
  const reset  = () => { setRunning(false); setSecondsLeft(initialRef.current); };

  // Presets utilitaires
  function applyPreset(total:number){
    total = Math.max(0, Math.floor(total));
    const m = Math.floor(total/60);
    const s = total % 60 as 0|15|30|45;
    setMinutes(m);
    setSecAdd((s===15||s===30||s===45 ? s : 0) as 0|15|30|45);
  }

  // Affichage temps
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const fmt = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  // === RING (SVG) ===
  const size = 220;                  // largeur/hauteur du SVG
  const stroke = 12;                 // épaisseur du trait
  const r = (size - stroke) / 2;     // rayon
  const cx = size/2, cy = size/2;
  const C = 2 * Math.PI * r;         // circonférence

  const pctDone = 1 - Math.min(1, Math.max(0, secondsLeft / (initialRef.current || 1)));
  const dashOffset = C * (1 - pctDone); // 0 = plein, C = vide

  return (
    <section
      className="rounded-[14px] space-y-8"
      style={{ background:"var(--bg)", border:"1px solid rgba(0,0,0,.08)", boxShadow:"var(--shadow)", padding:"28px" }}
    >
      {/* RING + Temps au centre */}
      <div className="flex justify-center">
        <div style={{ position:"relative", width:size, height:size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <defs>
              <linearGradient id="gradBrand" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"  stopColor="var(--brand)" />
                <stop offset="100%" stopColor="var(--brand2)" />
              </linearGradient>
            </defs>

            {/* Track (fond) */}
            <circle
              cx={cx} cy={cy} r={r}
              stroke="rgba(0,0,0,.08)"
              strokeWidth={stroke}
              fill="none"
            />

            {/* Progress (tourne à partir du haut) */}
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              <circle
                cx={cx} cy={cy} r={r}
                stroke="url(#gradBrand)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={dashOffset}
                fill="none"
                style={{ filter:"saturate(.9)" }}
              />
            </g>
          </svg>

          {/* Temps centré */}
          <div
            style={{
              position:"absolute", inset:0, display:"grid", placeItems:"center",
              fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontWeight:700, fontSize:"56px", lineHeight:1, letterSpacing:"0.02em",
            }}
          >
            {fmt}
          </div>
        </div>
      </div>

      {/* Sélecteurs centrés */}
      <div className="flex flex-col items-center gap-4">
        {/* Minutes */}
        <div className="flex items-center gap-3">
          <label className="text-sm" style={{color:"var(--muted)"}}>Minutes</label>
          <input
            type="number" min={0} step={1}
            value={minutes}
            disabled={running}
            onChange={(e) => setMinutes(clamp(Number(e.target.value || 0), 0, 600))}
            className="rounded-[12px] text-sm"
            style={{ width:"96px", padding:".6rem .75rem", background:"var(--bg)", border:"1px solid rgba(0,0,0,.12)", color:"var(--text)" }}
          />
        </div>

        {/* +0 / +15 / +30 / +45 secondes */}
        <div
          className="inline-flex gap-1.5 rounded-[12px]"
          style={{ padding:"8px", background:"var(--panel)", border:"1px solid rgba(0,0,0,.06)" }}
        >
          {[0,15,30,45].map(v => (
            <button
              key={v}
              type="button"
              disabled={running}
              onClick={() => setSecAdd(v as 0|15|30|45)}
              style={{
                padding:".55rem .9rem", borderRadius:"10px",
                fontWeight:700, fontSize:".9rem",
                color: v===secAdd ? "#fff" : "var(--muted)",
                background: v===secAdd ? "linear-gradient(90deg,var(--brand),var(--brand2))" : "transparent",
                boxShadow: v===secAdd ? "var(--shadow)" : "none",
              }}
            >
              +{v}s
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" disabled={running} onClick={() => applyPreset(30)}
            style={{ background:"var(--panel)", color:"var(--text)", border:"1px solid rgba(0,0,0,.06)", borderRadius:"var(--radius)", padding:".6rem .9rem", fontWeight:700, fontSize:".9rem", boxShadow:"var(--shadow)" }}>
            30s
          </button>
          <button type="button" disabled={running} onClick={() => applyPreset(90)}
            style={{ background:"var(--panel)", color:"var(--text)", border:"1px solid rgba(0,0,0,.06)", borderRadius:"var(--radius)", padding:".6rem .9rem", fontWeight:700, fontSize:".9rem", boxShadow:"var(--shadow)" }}>
            1:30
          </button>
          <button type="button" disabled={running} onClick={() => applyPreset(180)}
            style={{ background:"var(--panel)", color:"var(--text)", border:"1px solid rgba(0,0,0,.06)", borderRadius:"var(--radius)", padding:".6rem .9rem", fontWeight:700, fontSize:".9rem", boxShadow:"var(--shadow)" }}>
            3:00
          </button>
        </div>
      </div>

      {/* Actions centrées */}
      <div className="flex justify-center gap-4">
        <button onClick={toggle} className="btn-dash">{running ? "Pause" : "Démarrer"}</button>
        <button onClick={reset} className="btn-dash">Réinitialiser</button>
      </div>
    </section>
  );
}
