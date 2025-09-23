// apps/web/components/GrayCoach.tsx
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
  /** Exercice confirmé par l’utilisateur (prioritaire) */
  exerciseOverride?: string;
  height?: number;
};

export default function GrayCoach({ analysis, exerciseOverride, height = 420 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [speed, setSpeed] = useState(1);

  const effectiveExercise =
    (exerciseOverride && exerciseOverride.trim()) ||
    analysis.exercise ||
    analysis.movement_pattern ||
    "exercice";

  const preset = choosePresetFromLabels(effectiveExercise, analysis.movement_pattern);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t0 = performance.now();

    const loop = (now: number) => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const wantW = Math.floor(canvas.clientWidth * dpr);
      const wantH = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== wantW || canvas.height !== wantH) {
        canvas.width = wantW;
        canvas.height = wantH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Fond
      drawBackground(ctx, w, h, preset);

      // Temps (cycle 2.4s, modulé par speed)
      const cycle = 2400 / Math.max(0.2, speed);
      const phase = ((now % cycle) / cycle) as number;

      const guides = buildGuidesFromFaults(analysis);

      drawGrayHuman(ctx, w, h, phase, preset, guides);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [analysis, speed, preset]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">
          Mouvement corrigé&nbsp;:{" "}
          <span className="font-medium">{labelize(effectiveExercise)}</span>
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
          Silhouette corrigée (guides actifs)
        </div>
      </div>
    </div>
  );
}

/* ---------------- Presets ---------------- */

type PresetName = "squat" | "hinge" | "lunge" | "ohp" | "pushup" | "pull" | "pullup";

function choosePresetFromLabels(labelA?: string, movementPattern?: string): PresetName {
  const label = (labelA || "").toLowerCase();
  const mp = (movementPattern || "").toLowerCase();

  // ✅ Tractions = pullup
  if (/(traction|pull[\s-]?up|chin[\s-]?up|chest[\s-]?to[\s-]?bar)/.test(label)) return "pullup";

  if (/(squat|front\s*squat|goblet)/.test(label)) return "squat";
  if (/(deadlift|soulevé|romanian|rdl)/.test(label)) return "hinge";
  if (/(lunge|fente)/.test(label)) return "lunge";
  if (/(press|développé|overhead|shoulder)/.test(label)) return "ohp";
  if (/(push-?up|pompes?)/.test(label)) return "pushup";
  if (/(row|tirage|lat\s*pull)/.test(label)) return "pull";

  if (/hinge|hip/.test(mp)) return "hinge";
  if (/squat|knee/.test(mp)) return "squat";
  return "squat";
}

/* --------------- Guides (corrections) --------------- */

type Guides = {
  neutralSpine: boolean;
  chinTuck: boolean;
  kneesTrack: "good" | "valgusLight" | "valgusStrong";
  feetAnchor: "heels" | "mid" | "fore" | "auto";
};

function buildGuidesFromFaults(a: AIAnalysis): Guides {
  const issues = (a.faults || []).map(f => (f.issue || "").toLowerCase());

  const neutralSpine = !issues.some(i => /(dos trop cambr|hyperlordose|lordose|bassin en antéversion)/.test(i));
  const chinTuck = issues.some(i => /(tête|nuque|menton|projetée|cassée)/.test(i));
  let kneesTrack: Guides["kneesTrack"] = "good";
  if (issues.some(i => /(valgus|genoux qui rentrent)/.test(i))) {
    kneesTrack = issues.some(i => /(élevée|forte|très)/.test(i)) ? "valgusStrong" : "valgusLight";
  }
  let feetAnchor: Guides["feetAnchor"] = "auto";
  if (issues.some(i => /(talons.*décollent|pieds instables)/.test(i))) feetAnchor = "heels";

  const cue = (a.skeleton_cues || [])[0];
  if (cue?.feet?.anchor) {
    feetAnchor =
      cue.feet.anchor === "talons" ? "heels" :
      cue.feet.anchor === "milieu" ? "mid" :
      cue.feet.anchor === "avant" ? "fore" : "auto";
  }
  return { neutralSpine, chinTuck, kneesTrack, feetAnchor };
}

/* --------------- Dessin du fond --------------- */

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, preset: PresetName) {
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, w, h);

  // sol / décor simple
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  const floorH = Math.round(h * 0.14);
  ctx.fillRect(0, h - floorH, w, floorH);

  // Ligne d’horizon
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(h * 0.3));
  ctx.lineTo(w, Math.round(h * 0.3));
  ctx.stroke();

  // Barre fixe pour les tractions
  if (preset === "pullup") {
    ctx.strokeStyle = "rgba(200,200,200,0.9)";
    ctx.lineWidth = 8;
    const y = Math.round(h * 0.18);
    ctx.beginPath();
    ctx.moveTo(Math.round(w * 0.12), y);
    ctx.lineTo(Math.round(w * 0.88), y);
    ctx.stroke();
  }
}

/* --------------- Primitives & types --------------- */

type Joint = { x: number; y: number };
type Pose = {
  head: Joint; neck: Joint; spineTop: Joint; spineBottom: Joint;
  hipL: Joint; hipR: Joint; kneeL: Joint; kneeR: Joint; ankleL: Joint; ankleR: Joint;
  shoulderL: Joint; shoulderR: Joint; elbowL: Joint; elbowR: Joint; wristL: Joint; wristR: Joint;
  /** mains accrochées (pull-up) */
  gripL?: Joint; gripR?: Joint;
};

function drawBone(ctx: CanvasRenderingContext2D, a: Joint, b: Joint) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/* --------------- Silhouette + animation --------------- */

function drawGrayHuman(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
  preset: PresetName,
  guides: Guides
) {
  const cx = w * 0.5;
  const baseY = preset === "pullup" ? h * 0.88 : h * 0.82;
  const scale = Math.min(w, h) * 0.45;

  const pose = generatePose(cx, baseY, scale, phase, preset, guides, w, h);

  // Ombre
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 8, scale * 0.45, scale * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Silhouette
  ctx.strokeStyle = "rgba(180,180,180,0.95)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";

  // Tronc
  drawBone(ctx, pose.head, pose.neck);
  drawBone(ctx, pose.neck, pose.spineTop);
  drawBone(ctx, pose.spineTop, pose.spineBottom);

  // Hanches
  drawBone(ctx, pose.spineBottom, pose.hipL);
  drawBone(ctx, pose.spineBottom, pose.hipR);

  // Jambes
  drawBone(ctx, pose.hipL, pose.kneeL);
  drawBone(ctx, pose.kneeL, pose.ankleL);
  drawBone(ctx, pose.hipR, pose.kneeR);
  drawBone(ctx, pose.kneeR, pose.ankleR);

  // Bras
  drawBone(ctx, pose.spineTop, pose.shoulderL);
  drawBone(ctx, pose.spineTop, pose.shoulderR);
  drawBone(ctx, pose.shoulderL, pose.elbowL);
  drawBone(ctx, pose.elbowL, pose.wristL);
  drawBone(ctx, pose.shoulderR, pose.elbowR);
  drawBone(ctx, pose.elbowR, pose.wristR);

  // Poignées mains (pull-up)
  if (pose.gripL && pose.gripR) {
    ctx.beginPath();
    ctx.arc(pose.gripL.x, pose.gripL.y, 5, 0, Math.PI * 2);
    ctx.arc(pose.gripR.x, pose.gripR.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,200,200,0.95)";
    ctx.fill();
  }

  // Tête
  ctx.fillStyle = "rgba(180,180,180,0.95)";
  ctx.beginPath();
  ctx.arc(pose.head.x, pose.head.y, scale * 0.06, 0, Math.PI * 2);
  ctx.fill();

  drawGuides(ctx, pose, guides, scale, preset);
}

function generatePose(
  cx: number,
  baseY: number,
  s: number,
  phase: number,
  preset: PresetName,
  guides: Guides,
  w?: number,
  h?: number
): Pose {
  if (preset === "pullup") {
    // Animation verticale : 0 → accroché bras tendus, 0.5 → menton au dessus, 1 → retour bas
    const up = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2); // 0..1..0
    const barY = (h || 0) * 0.18;
    const barLeft = (w || 0) * 0.28;
    const barRight = (w || 0) * 0.72;
    const gripL = { x: barLeft, y: barY };
    const gripR = { x: barRight, y: barY };

    // Corps se translate vers la barre
    const hangDistance = s * 0.65;     // distance tête→barre bras tendus
    const topDistance = s * 0.15;      // distance tête→barre en haut
    const headY = mix(barY + hangDistance, barY + topDistance, up);

    const spineTopY = headY + s * 0.16;
    const spineBottomY = spineTopY + s * 0.28;

    const shoulderWidth = s * 0.28;
    const hipWidth = s * 0.18;

    const head = { x: cx, y: headY };
    const neck = { x: cx, y: headY + s * 0.10 };
    const spineTop = { x: cx, y: spineTopY };
    const spineBottom = { x: cx, y: spineBottomY };

    // Épaules — rapprochées en haut (dépression scapulaire)
    const shoulderT = mix(shoulderWidth * 0.55, shoulderWidth * 0.35, up);
    const shoulderL = { x: cx - shoulderT, y: spineTop.y };
    const shoulderR = { x: cx + shoulderT, y: spineTop.y };

    // Coudes : se fléchissent en haut
    const elbowDrop = mix(s * 0.34, s * 0.12, up);
    const elbowL = { x: mix(shoulderL.x, gripL.x, 0.35), y: spineTop.y + elbowDrop };
    const elbowR = { x: mix(shoulderR.x, gripR.x, 0.35), y: spineTop.y + elbowDrop };

    // Poignets tirés vers la barre
    const wristL = { x: gripL.x, y: gripL.y + 6 };
    const wristR = { x: gripR.x, y: gripR.y + 6 };

    // Jambes légèrement fléchies en haut
    const kneeBend = mix(0.10, 0.35, up);
    const stance = s * 0.20;
    const hipL = { x: cx - hipWidth / 2, y: spineBottom.y };
    const hipR = { x: cx + hipWidth / 2, y: spineBottom.y };
    const kneeDrop = s * (0.20 + kneeBend * 0.35);
    const kneeL = { x: cx - stance / 2, y: baseY - kneeDrop };
    const kneeR = { x: cx + stance / 2, y: baseY - kneeDrop };
    const ankleL = { x: cx - stance / 2, y: baseY };
    const ankleR = { x: cx + stance / 2, y: baseY };

    // Menton rentré si guide
    if (guides.chinTuck) {
      head.x = head.x * 0.985 + neck.x * 0.015;
    }

    return { head, neck, spineTop, spineBottom, hipL, hipR, kneeL, kneeR, ankleL, ankleR, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR, gripL, gripR };
  }

  // --- presets au sol (squat/hinge/lunge/pushup/ohp/row) : version précédente ---
  const depth = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
  const hipWidth = s * 0.16;
  const shoulderWidth = s * 0.20;
  const torsoLen =
    preset === "hinge" ? s * 0.42 :
    preset === "lunge" ? s * 0.43 :
    s * 0.45;

  const kneeBend =
    preset === "squat" ? mix(0.05, 0.65, depth) :
    preset === "lunge" ? mix(0.05, 0.60, depth) :
    preset === "hinge" ? mix(0.05, 0.35, depth) :
    preset === "pushup" ? mix(0.15, 0.55, depth) :
    preset === "ohp" || preset === "pull" ? mix(0.05, 0.20, depth) :
    mix(0.05, 0.5, depth);

  let torsoTilt =
    preset === "hinge" ? mix(0, Math.PI * 0.35, depth) :
    preset === "squat" ? mix(0, Math.PI * 0.18, depth) :
    preset === "lunge" ? mix(0, Math.PI * 0.2, depth) :
    preset === "pushup" ? 0 :
    preset === "ohp" || preset === "pull" ? 0 : 0;

  if (guides.neutralSpine) torsoTilt *= 0.8;

  const spineBottom = { x: cx, y: baseY - s * (0.18 + kneeBend * 0.10) };
  const spineTop = { x: cx, y: spineBottom.y - torsoLen * Math.cos(torsoTilt) };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.06 };
  const head = { x: neck.x, y: neck.y - s * 0.10 };

  const shoulderL = { x: spineTop.x - shoulderWidth / 2, y: spineTop.y };
  const shoulderR = { x: spineTop.x + shoulderWidth / 2, y: spineTop.y };

  const hipL = { x: spineBottom.x - hipWidth / 2, y: spineBottom.y };
  const hipR = { x: spineBottom.x + hipWidth / 2, y: spineBottom.y };

  const stance = s * 0.36;
  const ankleL = { x: cx - stance / 2, y: baseY };
  const ankleR = { x: cx + stance / 2, y: baseY };

  const kneeSpread =
    guides.kneesTrack === "good" ? stance * 0.28 :
    guides.kneesTrack === "valgusLight" ? stance * 0.18 :
    stance * 0.10;

  const kneeDrop = s * (0.18 + kneeBend * 0.25);
  const kneeL = { x: cx - kneeSpread / 2, y: baseY - kneeDrop };
  const kneeR = { x: cx + kneeSpread / 2, y: baseY - kneeDrop };

  let elbowOffset = s * 0.16;
  let wristOffset = s * 0.16;
  if (preset === "ohp") elbowOffset = s * 0.12;

  const elbowL = { x: shoulderL.x - elbowOffset * 0.6, y: shoulderL.y + elbowOffset * 0.4 };
  const elbowR = { x: shoulderR.x + elbowOffset * 0.6, y: shoulderR.y + elbowOffset * 0.4 };
  const wristL = { x: elbowL.x - wristOffset * 0.5, y: elbowL.y + wristOffset * 0.3 };
  const wristR = { x: elbowR.x + wristOffset * 0.5, y: elbowR.y + wristOffset * 0.3 };

  if (guides.chinTuck) head.x = head.x * 0.98 + neck.x * 0.02;

  return { head, neck, spineTop, spineBottom, hipL, hipR, kneeL, kneeR, ankleL, ankleR, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR };
}

/* --------------- Guides visuels --------------- */

function drawGuides(ctx: CanvasRenderingContext2D, pose: Pose, guides: Guides, s: number, preset: PresetName) {
  if (guides.neutralSpine) {
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

  // Pour pullup, on n'affiche pas les flèches genoux (pas pertinent) – on garde le check “OK”
  if (preset !== "pullup") {
    if (guides.kneesTrack !== "good") {
      const color = guides.kneesTrack === "valgusLight" ? "#FFD266" : "#FF7C7C";
      arrow(ctx, pose.kneeL.x, pose.kneeL.y, pose.kneeL.x - s * 0.10, pose.kneeL.y, color);
      arrow(ctx, pose.kneeR.x, pose.kneeR.y, pose.kneeR.x + s * 0.10, pose.kneeR.y, color);
      drawTag(ctx, pose.kneeR.x + s * 0.12, pose.kneeR.y - s * 0.06, "Pousse les genoux vers l’extérieur");
    } else {
      check(ctx, (pose.kneeL.x + pose.kneeR.x) / 2, pose.kneeL.y - s * 0.12, "#9EF79E");
    }
  }

  if (guides.chinTuck) {
    arrow(ctx, pose.head.x + s * 0.08, pose.head.y, pose.head.x - s * 0.02, pose.head.y, "#FFC97C");
    drawTag(ctx, pose.head.x + s * 0.10, pose.head.y + s * 0.04, "Rentre légèrement le menton");
  }
}

/* --------------- Primitives --------------- */

function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.save();
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const padX = 8, padY = 5;
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
  const headlen = 9;
  const dx = x2 - x1;
  const dy = y
