// apps/web/components/Timer.tsx
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

  // ====== AUDIO (typesafe) ======
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false); // ✅ iOS: déverrouillé par geste

  async function ensureAudioCtx(): Promise<AudioContext | null> {
    try {
      if (typeof window === "undefined") return null;
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;

      let ctx: AudioContext | null = audioCtxRef.current;
      if (!ctx) {
        ctx = new Ctx() as AudioContext;
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      return ctx;
    } catch {
      return null;
    }
  }

  // ✅ Déverrouillage iOS/Android : jouer une frame silencieuse sur geste utilisateur
  async function unlockAudioWithSilence() {
    try {
      if (audioUnlockedRef.current) return;
      const ctx = await ensureAudioCtx();
      if (!ctx) return;
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      audioUnlockedRef.current = true;
    } catch {}
  }

  async function playFinishChime() {
    const ctx = await ensureAudioCtx();
    if (!ctx) return;

    const makeNote = (freq: number, start: number, dur = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.85, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    const now = ctx.currentTime;
    // double chime “exercice fini” — ne coupe pas Spotify (même sortie audio, autre source)
    makeNote(1318.51, now + 0.00, 0.18); // E6
    makeNote(1760.00, now + 0.20, 0.20); // A6
  }
  // ====================

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
          if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
          // ✅ ne joue le bip que si l’audio a été déverrouillé par un geste avant
          if (audioUnlockedRef.current) void playFinishChime();
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

  // ▶️ Démarrer / ⏸️ Pause
  const toggle = async () => {
    if (running) {
      setRunning(false);
      return;
    }
    // ✅ START/RESUME : déverrouille franchement (iOS) + prépare le contexte
    await unlockAudioWithSilence();
    await ensureAudioCtx();
    if (secondsLeft > 0) setRunning(true);
  };

  // 🔄 Réinitialiser
  const reset  = async () => {
    setRunning(false);
    setSecondsLeft(initialRef.current);
    // Optionnel : on prépare l'audio pour un prochain départ
    await ensureAudioCtx();
  };

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
  const size = 220;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size/2, cy = size/2;
  const C = 2 * Math.PI * r;

  const pctDone = 1 - Math.min(1, Math.max(0, secondsLeft / (initialRef.current || 1)));
  const dashOffset = C * (1 - pctDone);

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
            <circle cx={cx} cy={cy} r={r} stroke="rgba(0,0,0,.08)" strokeWidth={stroke} fill="none" />
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

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button onClick={toggle} className="btn-dash">{running ? "Pause" : "Démarrer"}</button>
        <button onClick={reset} className="btn-dash">Réinitialiser</button>
      </div>
    </section>
  );
}

