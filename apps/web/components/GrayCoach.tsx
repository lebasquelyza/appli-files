"use client";

import React, { useEffect, useRef, useState } from "react";

/** Types minimaux */
type Fault = { issue: string; severity: "faible" | "moyenne" | "élevée"; correction?: string };
type SkeletonCue = {
  phase?: "setup" | "descente" | "bas" | "montée" | "lockout";
  spine?: { neutral?: boolean; tilt_deg?: number };
  knees?: { valgus_level?: 0 | 1 | 2; should_bend?: boolean };
  head?: { chin_tuck?: boolean };
  feet?: { anchor?: "talons" | "milieu" | "avant"; unstable?: boolean };
  notes?: string;
};
type AIAnalysis = {
  exercise: string;
  movement_pattern?: string;
  faults?: Fault[];
  corrections?: string[];
  skeleton_cues?: SkeletonCue[];
};

type Props = {
  analysis: AIAnalysis;
  height?: number; // hauteur du canvas (px)
};

/* ------------------------------------------------------ */

export default function GrayCoach({ analysis, height = 420 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [speed, setSpeed] = useState(1.0);

  const preset = choosePreset(analysis);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cssW = c.clientWidth;
      const cssH = c.clientHeight;
      if (c.width !== Math.floor(cssW * dpr) || c.height !== Math.floor(cssH * dpr)) {
        c.width = Math.floor(cssW * dpr);
        c.height = Math.floor(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // fond
      drawBackground(ctx, cssW, cssH);

      // phase de 0..1 (durée ajustée par speed)
      const baseCycleMs =
        preset === "pullup" || preset === "pushup" || preset === "ohp" || preset === "row"
          ? 2200
          : preset === "lunge"
          ? 2400
          : 2000;
      const cycle = baseCycleMs / Math.max(0.2, speed);
      const phase = ((now % cycle) / cycle) as number;

      const guides = buildGuidesFromFaults(analysis);

      drawMannequin(ctx, cssW, cssH, phase, preset, guides);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analysis, preset, speed]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">
          Mouvement corrigé&nbsp;:{" "}
          <span className="font-medium">{labelize(analysis.exercise || analysis.movement_pattern || "Exercice")}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>Vitesse</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-40"
          />
          <span>{speed.toFixed(1)}x</span>
        </div>
      </div>

      <div className="relative w-full border rounded-2xl overflow-hidden" style={{ height }}>
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div className="absolute top-2 left-2 rounded-md bg-black/60 text-white text-[11px] px-2 py-1">
          Silhouette corrigée (mannequin)
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Exercise mapping ---------------------- */

type PresetName =
  | "squat"
  | "hinge" // deadlift / RDL
  | "lunge"
  | "pushup"
  | "pullup" // tractions / chin-up / chest-to-bar
  | "ohp" // overhead press
  | "row" // rowing horizontal
  | "hipthrust";

function choosePreset(a: AIAnalysis): PresetName {
  const s = (a.exercise || a.movement_pattern || "").toLowerCase();

  if (/(pull[\s-]?up|chin[\s-]?up|chest[\s-]?to[\s-]?bar|tractions?)/.test(s)) return "pullup";
  if (/(push[\s-]?up|pompes?)/.test(s)) return "pushup";
  if (/(overhead|shoulder|militaire|ohp|press)/.test(s)) return "ohp";
  if (/(row|tirage horizontal|seated\s*row)/.test(s)) return "row";
  if (/(hip\s*thrust|extension de hanches)/.test(s)) return "hipthrust";
  if (/(dead[\s-]?lift|soulevé|romanian|rdl|hinge)/.test(s)) return "hinge";
  if (/(lunge|fentes?)/.test(s)) return "lunge";
  if (/(front\s*squat|back\s*squat|squat)/.test(s)) return "squat";

  // fallback via movement_pattern
  const mp = (a.movement_pattern || "").toLowerCase();
  if (/hinge|hip/.test(mp)) return "hinge";
  if (/knee|squat/.test(mp)) return "squat";
  return "squat";
}

/* ---------------------- Guides ---------------------- */

type Guides = {
  neutralSpine: boolean;
  chinTuck: boolean;
  kneesTrack: "good" | "valgusLight" | "valgusStrong";
  feetAnchor: "heels" | "mid" | "fore" | "auto";
};

function buildGuidesFromFaults(a: AIAnalysis): Guides {
  const issues = (a.faults || []).map((f) => (f.issue || "").toLowerCase());

  const neutralSpine = !issues.some((i) => /(dos trop cambr|hyperlordose|lordose|antéversion)/.test(i));
  const chinTuck = issues.some((i) => /(tête|nuque|menton|projetée|cassée)/.test(i));

  let kneesTrack: Guides["kneesTrack"] = "good";
  if (issues.some((i) => /(valgus|genoux qui rentrent)/.test(i))) {
    kneesTrack = issues.some((i) => /(élevée|forte|très)/.test(i)) ? "valgusStrong" : "valgusLight";
  }

  let feetAnchor: Guides["feetAnchor"] = "auto";
  if (issues.some((i) => /(talons.*décollent|pieds instables)/.test(i))) feetAnchor = "heels";

  const cue = (a.skeleton_cues || [])[0];
  if (cue?.feet?.anchor) {
    feetAnchor = cue.feet.anchor === "talons" ? "heels" : cue.feet.anchor === "milieu" ? "mid" : cue.feet.anchor === "avant" ? "fore" : "auto";
  }

  return { neutralSpine, chinTuck, kneesTrack, feetAnchor };
}

/* ---------------------- Drawing ---------------------- */

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  const floor = Math.round(h * 0.14);
  ctx.fillRect(0, h - floor, w, floor);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(h * 0.3));
  ctx.lineTo(w, Math.round(h * 0.3));
  ctx.stroke();
}

type Joint = { x: number; y: number };

function drawLimb(ctx: CanvasRenderingContext2D, a: Joint, b: Joint, thickness: number) {
  // segment arrondi (caps)
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(190,190,190,0.95)";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, c: Joint, r: number) {
  ctx.fillStyle = "rgba(190,190,190,0.95)";
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.save();
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const padX = 8,
    padY = 5;
  const textW = Math.ceil(ctx.measureText(text).width);
  const boxW = textW + padX * 2;
  const boxH = 22;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + padX, y + boxH - padY - 2);
  ctx.restore();
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#22c55e") {
  const head = 9;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function check(ctx: CanvasRenderingContext2D, x: number, y: number, color = "#7CFFB2") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x - 2, y + 6);
  ctx.lineTo(x + 8, y - 8);
  ctx.stroke();
  ctx.restore();
}

/* ---------------------- Mannequin per exercise ---------------------- */

function drawMannequin(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
  preset: PresetName,
  guides: Guides
) {
  const cx = w * 0.5;
  const baseY = h * 0.82;
  const s = Math.min(w, h) * 0.45;

  // Ombre
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 8, s * 0.45, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // éléments de décor selon l'exo
  if (preset === "pullup") {
    // barre haute
    const barY = h * 0.18;
    ctx.strokeStyle = "rgba(180,180,180,0.7)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.7, barY);
    ctx.lineTo(cx + s * 0.7, barY);
    ctx.stroke();
  } else if (preset === "pushup") {
    // sol mis en avant
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(cx - s * 0.7, baseY - 6, s * 1.4, 12);
  }

  // Poses selon l'exercice
  switch (preset) {
    case "pullup":
      mannequinPullup(ctx, cx, baseY, s, phase, guides);
      break;
    case "pushup":
      mannequinPushup(ctx, cx, baseY, s, phase, guides);
      break;
    case "ohp":
      mannequinOHP(ctx, cx, baseY, s, phase, guides);
      break;
    case "row":
      mannequinRow(ctx, cx, baseY, s, phase, guides);
      break;
    case "hipthrust":
      mannequinHipThrust(ctx, cx, baseY, s, phase, guides);
      break;
    case "lunge":
      mannequinLunge(ctx, cx, baseY, s, phase, guides);
      break;
    case "hinge":
      mannequinHinge(ctx, cx, baseY, s, phase, guides);
      break;
    case "squat":
    default:
      mannequinSquat(ctx, cx, baseY, s, phase, guides);
      break;
  }
}

/* ---------------------- Individual animations ---------------------- */

function mannequinPullup(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, phase: number, g: Guides) {
  // aller-retour vertical (accélération douce)
  const t = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
  const barY = baseY - s * 0.9;
  const bodyY = mix(baseY - s * 0.15, barY + s * 0.18, t);

  // tronc
  const spineTop = { x: cx, y: bodyY - s * 0.22 };
  const spineBottom = { x: cx, y: bodyY };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.05 };
  const head = { x: neck.x, y: neck.y - s * 0.09 };

  // jambes (légère flexion)
  const stance = s * 0.18;
  const ankleL = { x: cx - stance / 2, y: bodyY + s * 0.22 };
  const ankleR = { x: cx + stance / 2, y: bodyY + s * 0.22 };
  const kneeL = { x: cx - stance / 2, y: bodyY + s * 0.10 };
  const kneeR = { x: cx + stance / 2, y: bodyY + s * 0.10 };

  // épaules → coudes → mains (accrochées à la barre)
  const shoulderW = s * 0.22;
  const shoulderL = { x: cx - shoulderW / 2, y: spineTop.y };
  const shoulderR = { x: cx + shoulderW / 2, y: spineTop.y };

  // mains fixées sur la barre
  const handL = { x: cx - shoulderW / 2, y: barY };
  const handR = { x: cx + shoulderW / 2, y: barY };

  // coude selon phase (plié en haut)
  const elbowBend = mix(0.1, 0.6, t); // 0: bras tendus, 1: pliés
  const elbowL = { x: mix(shoulderL.x, handL.x, 0.5 - 0.25 * elbowBend), y: mix(shoulderL.y, handL.y, 0.5 + 0.15 * elbowBend) };
  const elbowR = { x: mix(shoulderR.x, handR.x, 0.5 + 0.25 * elbowBend), y: mix(shoulderR.y, handR.y, 0.5 + 0.15 * elbowBend) };

  // dessiner
  // jambes
  drawLimb(ctx, kneeL, ankleL, 8);
  drawLimb(ctx, kneeR, ankleR, 8);
  drawLimb(ctx, spineBottom, kneeL, 10);
  drawLimb(ctx, spineBottom, kneeR, 10);

  // tronc
  drawLimb(ctx, spineBottom, spineTop, 12);
  drawLimb(ctx, spineTop, neck, 10);

  // bras + mains vers la barre
  drawLimb(ctx, shoulderL, elbowL, 9);
  drawLimb(ctx, elbowL, handL, 8);
  drawLimb(ctx, shoulderR, elbowR, 9);
  drawLimb(ctx, elbowR, handR, 8);

  // tête
  drawCircle(ctx, head, s * 0.055);

  drawGuides(ctx, { head, neck, spineTop, spineBottom, kneeL, kneeR, ankleL, ankleR }, g, s);
}

function mannequinPushup(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, phase: number, g: Guides) {
  const t = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
  const chestY = mix(baseY - s * 0.28, baseY - s * 0.12, t); // descend/monte

  const spineBottom = { x: cx, y: chestY + s * 0.12 };
  const spineTop = { x: cx, y: chestY - s * 0.06 };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.05 };
  const head = { x: neck.x + (g.chinTuck ? -s * 0.01 : 0), y: neck.y - s * 0.075 };

  const shoulderW = s * 0.28;
  const shoulderL = { x: cx - shoulderW / 2, y: spineTop.y };
  const shoulderR = { x: cx + shoulderW / 2, y: spineTop.y };

  const handY = baseY;
  const handL = { x: shoulderL.x, y: handY };
  const handR = { x: shoulderR.x, y: handY };

  const elbowT = t; // pliage en bas
  const elbowL = { x: mix(shoulderL.x, handL.x, 0.62 - 0.12 * elbowT), y: mix(shoulderL.y, handL.y, 0.52 + 0.20 * elbowT) };
  const elbowR = { x: mix(shoulderR.x, handR.x, 0.38 + 0.12 * elbowT), y: mix(shoulderR.y, handR.y, 0.52 + 0.20 * elbowT) };

  // jambes (corps en planche)
  const ankleL = { x: cx - s * 0.18, y: baseY + 2 };
  const ankleR = { x: cx + s * 0.18, y: baseY + 2 };
  const kneeL = { x: mix(ankleL.x, spineBottom.x, 0.48), y: mix(ankleL.y, spineBottom.y, 0.48) };
  const kneeR = { x: mix(ankleR.x, spineBottom.x, 0.48), y: mix(ankleR.y, spineBottom.y, 0.48) };

  // dessiner
  drawLimb(ctx, ankleL, kneeL, 8);
  drawLimb(ctx, ankleR, kneeR, 8);
  drawLimb(ctx, kneeL, spineBottom, 10);
  drawLimb(ctx, kneeR, spineBottom, 10);
  drawLimb(ctx, spineBottom, spineTop, 12);
  drawLimb(ctx, spineTop, neck, 10);
  drawLimb(ctx, shoulderL, elbowL, 9);
  drawLimb(ctx, elbowL, handL, 8);
  drawLimb(ctx, shoulderR, elbowR, 9);
  drawLimb(ctx, elbowR, handR, 8);
  drawCircle(ctx, head, s * 0.05);

  drawGuides(ctx, { head, neck, spineTop, spineBottom, kneeL, kneeR, ankleL, ankleR }, g, s);
}

function mannequinOHP(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, phase: number, g: Guides) {
  const t = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
  const spineBottom = { x: cx, y: baseY - s * 0.18 };
  const spineTop = { x: cx, y: spineBottom.y - s * 0.40 };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.05 };
  const head = { x: neck.x - (g.chinTuck ? s * 0.01 : 0), y: neck.y - s * 0.075 };

  const shoulderW = s * 0.28;
  const shoulderL = { x: cx - shoulderW / 2, y: spineTop.y };
  const shoulderR = { x: cx + shoulderW / 2, y: spineTop.y };

  // barre (imaginaire) qui monte
  const handY = mix(spineTop.y - s * 0.05, spineTop.y - s * 0.55, t);
  const handL = { x: shoulderL.x + s * 0.02, y: handY };
  const handR = { x: shoulderR.x - s * 0.02, y: handY };
  const elbowL = { x: mix(shoulderL.x, handL.x, 0.5), y: mix(shoulderL.y, handL.y, 0.6) };
  const elbowR = { x: mix(shoulderR.x, handR.x, 0.5), y: mix(shoulderR.y, handR.y, 0.6) };

  const stance = s * 0.36;
  const ankleL = { x: cx - stance / 2, y: baseY };
  const ankleR = { x: cx + stance / 2, y: baseY };
  const kneeL = { x: ankleL.x, y: baseY - s * 0.14 };
  const kneeR = { x: ankleR.x, y: baseY - s * 0.14 };

  drawLimb(ctx, ankleL, kneeL, 8);
  drawLimb(ctx, ankleR, kneeR, 8);
  drawLimb(ctx, kneeL, spineBottom, 10);
  drawLimb(ctx, kneeR, spineBottom, 10);
  drawLimb(ctx, spineBottom, spineTop, 12);
  drawLimb(ctx, spineTop, neck, 10);
  drawLimb(ctx, shoulderL, elbowL, 9);
  drawLimb(ctx, elbowL, handL, 8);
  drawLimb(ctx, shoulderR, elbowR, 9);
  drawLimb(ctx, elbowR, handR, 8);
  drawCircle(ctx, head, s * 0.05);

  drawGuides(ctx, { head, neck, spineTop, spineBottom, kneeL, kneeR, ankleL, ankleR }, g, s);
}

function mannequinRow(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, phase: number, g: Guides) {
  const t = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2); // tirer/relâcher
  const hip = { x: cx, y: baseY - s * 0.18 };
  const spineTop = { x: cx - s * 0.05, y: hip.y - s * 0.36 }; // buste penché
  const spineBottom = hip;
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.05 };
  const head = { x: neck.x - s * 0.02, y: neck.y - s * 0.075 };

  const stance = s * 0.42;
  const ankleL = { x: cx - stance / 2, y: baseY };
  const ankleR = { x: cx + stance / 2, y: baseY };
  const kneeL = { x: ankleL.x, y: baseY - s * 0.2 };
  const kneeR = { x: ankleR.x, y: baseY - s * 0.2 };

  const shoulder = { x: spineTop.x, y: spineTop.y };
  const handX = mix(spineBottom.x - s * 0.3, spineBottom.x - s * 0.06, t);
  const handY = mix(spineBottom.y - s * 0.02, spineBottom.y - s * 0.18, t);
  const handL = { x: handX, y: handY };
  const handR = { x: handX + s * 0.08, y: handY + s * 0.02 };
  const elbowL = { x: mix(shoulder.x, handL.x, 0.5), y: mix(shoulder.y, handL.y, 0.5) };
  const elbowR = { x: mix(shoulder.x, handR.x, 0.5), y: mix(shoulder.y, handR.y, 0.5) };

  drawLimb(ctx, ankleL, kneeL, 8);
  drawLimb(ctx, ankleR, kneeR, 8);
  drawLimb(ctx, kneeL, spineBottom, 10);
  drawLimb(ctx, kneeR, spineBottom, 10);
  drawLimb(ctx, spineBottom, spineTop, 12);
  drawLimb(ctx, spineTop, neck, 10);
  drawLimb(ctx, shoulder, elbowL, 9);
  drawLimb(ctx, elbowL, handL, 8);
  drawLimb(ctx, shoulder, elbowR, 9);
  drawLimb(ctx, elbowR, handR, 8);
  drawCircle(ctx, head, s * 0.05);

  drawGuides(ctx, { head, neck, spineTop, spineBottom, kneeL, kneeR, ankleL, ankleR }, g, s);
}

function mannequinHipThrust(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, phase: number, g: Guides) {
  const t = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
  // dos au sol, hanches qui montent
  const shouldersY = baseY - s * 0.24;
  const hipsY = mix(baseY - s * 0.05, baseY - s * 0.22, t);

  const spineBottom = { x: cx, y: hipsY };
  const spineTop = { x: cx, y: shouldersY };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.04 };
  const head = { x: neck.x, y: neck.y - s * 0.06 };

  const ankleL = { x: cx - s * 0.22, y: baseY };
  const ankleR = { x: cx + s * 0.22, y: baseY };
  const kneeL = { x: cx - s * 0.18, y: mix(baseY - s * 0.16, baseY - s * 0.24, t) };
  const kneeR = { x: cx + s * 0.18, y: mix(baseY - s * 0.16, baseY - s * 0.24, t) };

  drawLimb(ctx, ankleL, kneeL, 8);
  drawLimb(ctx, ankleR, kneeR, 8);
  drawLimb(ctx, kneeL, spineBottom, 10);
  drawLimb(ctx, kneeR, spineBottom, 10);
  drawLimb(ctx, spineBottom, spineTop, 12);
  drawLimb(ctx, spineTop, neck, 10);
  drawCircle(ctx, head, s * 0.05);

  drawGuides(ctx, { head, neck, spineTop, spineBottom, kneeL, kneeR, ankleL, ankleR }, g, s);
}

function mannequinLunge(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, phase: number, g: Guides) {
  const t = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
  const stride = s * 0.36;

  const front = { ankle: { x: cx + stride / 2, y: baseY } };
  const back = { ankle: { x: cx - stride / 2, y: baseY } };

  const spineBottom = { x: cx, y: baseY - s * mix(0.24, 0.34, t) };
  const spineTop = { x: cx, y: spineBottom.y - s * 0.42 };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.05 };
  const head = { x: neck.x, y: neck.y - s * 0.075 };

  const frontKnee = { x: front.ankle.x, y: mix(baseY - s * 0.16, baseY - s * 0.28, t) };
  const backKnee = { x: back.ankle.x, y: mix(baseY - s * 0.10, baseY - s * 0.20, t) };

  drawLimb(ctx, back.ankle, backKnee, 8);
  drawLimb(ctx, backKnee, spineBottom, 10);
  drawLimb(ctx, front.ankle, frontKnee, 8);
  drawLimb(ctx, frontKnee, spineBottom, 10);
  drawLimb(ctx, spineBottom, spineTop, 12);
  drawLimb(ctx, spineTop, neck, 10);
  drawCircle(ctx, head, s * 0.05);

  drawGuides(ctx, { head, neck, spineTop, spineBottom, kneeL: frontKnee, kneeR: backKnee, ankleL: front.ankle, ankleR: back.ankle }, g, s);
}

function mannequinHinge(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, phase: number, g: Guides) {
  const t = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
  const hip = { x: cx, y: baseY - s * 0.18 };
  const torsoTilt = mix(0, Math.PI * 0.35, t) * (g.neutralSpine ? 0.85 : 1);

  const spineBottom = hip;
  const spineTop = { x: hip.x - Math.sin(torsoTilt) * s * 0.42, y: hip.y - Math.cos(torsoTilt) * s * 0.42 };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.05 };
  const head = { x: neck.x, y: neck.y - s * 0.07 };

  const stance = s * 0.42;
  const ankleL = { x: cx - stance / 2, y: baseY };
  const ankleR = { x: cx + stance / 2, y: baseY };
  const kneeDrop = mix(s * 0.10, s * 0.24, t);
  const kneeL = { x: ankleL.x, y: baseY - kneeDrop };
  const kneeR = { x: ankleR.x, y: baseY - kneeDrop };

  drawLimb(ctx, ankleL, kneeL, 8);
  drawLimb(ctx, ankleR, kneeR, 8);
  drawLimb(ctx, kneeL, spineBottom, 10);
  drawLimb(ctx, kneeR, spineBottom, 10);
  drawLimb(ctx, spineBottom, spineTop, 12);
  drawLimb(ctx, spineTop, neck, 10);
  drawCircle(ctx, head, s * 0.05);

  drawGuides(ctx, { head, neck, spineTop, spineBottom, kneeL, kneeR, ankleL, ankleR }, g, s);
}

function mannequinSquat(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, phase: number, g: Guides) {
  const t = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
  const stance = s * 0.42;

  const kneeBend = mix(0.06, 0.62, t);
  const spineBottom = { x: cx, y: baseY - s * (0.18 + kneeBend * 0.10) };
  const spineTop = { x: cx, y: spineBottom.y - s * 0.45 };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.05 };
  const head = { x: neck.x - (g.chinTuck ? s * 0.01 : 0), y: neck.y - s * 0.075 };

  const ankleL = { x: cx - stance / 2, y: baseY };
  const ankleR = { x: cx + stance / 2, y: baseY };
  const kneeSpread =
    g.kneesTrack === "good" ? stance * 0.28 : g.kneesTrack === "valgusLight" ? stance * 0.18 : stance * 0.10;
  const kneeDrop = s * (0.18 + kneeBend * 0.25);
  const kneeL = { x: cx - kneeSpread / 2, y: baseY - kneeDrop };
  const kneeR = { x: cx + kneeSpread / 2, y: baseY - kneeDrop };

  drawLimb(ctx, ankleL, kneeL, 8);
  drawLimb(ctx, ankleR, kneeR, 8);
  drawLimb(ctx, kneeL, spineBottom, 10);
  drawLimb(ctx, kneeR, spineBottom, 10);
  drawLimb(ctx, spineBottom, spineTop, 12);
  drawLimb(ctx, spineTop, neck, 10);
  drawCircle(ctx, head, s * 0.05);

  drawGuides(ctx, { head, neck, spineTop, spineBottom, kneeL, kneeR, ankleL, ankleR }, g, s);
}

/* ---------------------- Guides overlay ---------------------- */

type GuidePose = {
  head: Joint;
  neck: Joint;
  spineTop: Joint;
  spineBottom: Joint;
  kneeL: Joint;
  kneeR: Joint;
  ankleL: Joint;
  ankleR: Joint;
};

function drawGuides(ctx: CanvasRenderingContext2D, pose: GuidePose, g: Guides, s: number) {
  if (g.neutralSpine) {
    ctx.save();
    ctx.strokeStyle = "#7CFFB2";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pose.spineBottom.x, pose.spineBottom.y - s * 0.6);
    ctx.lineTo(pose.spineBottom.x, pose.spineBottom.y + s * 0.1);
    ctx.stroke();
    ctx.setLineDash([]);
    drawTag(ctx, pose.spineBottom.x + s * 0.12, pose.spineTop.y - s * 0.05, "Dos neutre");
    ctx.restore();
  }

  if (g.kneesTrack !== "good") {
    const color = g.kneesTrack === "valgusLight" ? "#FFD266" : "#FF7C7C";
    arrow(ctx, pose.kneeL.x, pose.kneeL.y, pose.kneeL.x - s * 0.10, pose.kneeL.y, color);
    arrow(ctx, pose.kneeR.x, pose.kneeR.y, pose.kneeR.x + s * 0.10, pose.kneeR.y, color);
    drawTag(ctx, pose.kneeR.x + s * 0.12, pose.kneeR.y - s * 0.06, "Pousse les genoux vers l’extérieur");
  } else {
    check(ctx, (pose.kneeL.x + pose.kneeR.x) / 2, pose.kneeL.y - s * 0.12, "#9EF79E");
  }

  if (g.chinTuck) {
    arrow(ctx, pose.head.x + s * 0.08, pose.head.y, pose.head.x - s * 0.02, pose.head.y, "#FFC97C");
    drawTag(ctx, pose.head.x + s * 0.10, pose.head.y + s * 0.04, "Rentre légèrement le menton");
  }

  if (g.feetAnchor !== "auto") {
    const txt =
      g.feetAnchor === "heels" ? "Poids sur talons/milieu" : g.feetAnchor === "mid" ? "Poids milieu du pied" : "Poids avant-pied";
    drawTag(ctx, (pose.ankleR.x + pose.ankleL.x) / 2 + s * 0.14, pose.ankleR.y - s * 0.06, txt);
  }
}

/* ---------------------- Math helpers ---------------------- */

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function labelize(s: string) {
  const x = (s || "").trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : "";
}
