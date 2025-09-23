// apps/web/components/GrayCoach.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

/** Types minimaux pour ne pas dépendre de la page */
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

export default function GrayCoach({ analysis, height = 420 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [speed, setSpeed] = useState(1); // 0.5x → 2x

  // Déduire un preset d’animation selon l’exo
  const preset = choosePreset(analysis);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t0 = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(50, now - t0); // clamp
      t0 = now;
      const w = canvas.width;
      const h = canvas.height;

      // HiDPI scale
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      if (canvas.width !== Math.floor(canvas.clientWidth * dpr) || canvas.height !== Math.floor(canvas.clientHeight * dpr)) {
        canvas.width = Math.floor(canvas.clientWidth * dpr);
        canvas.height = Math.floor(canvas.clientHeight * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Fond
      drawBackground(ctx, canvas.clientWidth, canvas.clientHeight);

      // Temps (cycle 2.4s par défaut, modulé par speed)
      const cycle = 2400 / Math.max(0.2, speed);
      const phase = ((now % cycle) / cycle) as number;

      // Règles de correction (issues -> guides)
      const guides = buildGuidesFromFaults(analysis);

      // Dessiner silhouette corrigée
      drawGrayHuman(ctx, canvas.clientWidth, canvas.clientHeight, phase, preset, guides);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [analysis, speed, preset]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">
          Mouvement corrigé&nbsp;: <span className="font-medium">{labelize(analysis.exercise || analysis.movement_pattern || "Exercice")}</span>
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
        {/* Légende courte */}
        <div className="absolute top-2 left-2 rounded-md bg-black/60 text-white text-[11px] px-2 py-1">
          Silhouette corrigée (guides actifs)
        </div>
      </div>
    </div>
  );
}

/* ---------------- Utils preset ---------------- */

function choosePreset(a: AIAnalysis): PresetName {
  const label = (a.exercise || a.movement_pattern || "").toLowerCase();
  if (/(squat|front\s*squat|goblet)/.test(label)) return "squat";
  if (/(deadlift|soulevé|romanian|rdl)/.test(label)) return "hinge";
  if (/(lunge|fente)/.test(label)) return "lunge";
  if (/(press|développé|overhead|shoulder)/.test(label)) return "ohp";
  if (/(push-?up|pompes?)/.test(label)) return "pushup";
  if (/(row|tirage|pull-?up|traction|lat\s*pull)/.test(label)) return "pull";
  // défaut : pattern vertical/horizontal/habituels
  const mp = (a.movement_pattern || "").toLowerCase();
  if (/hinge|hip/.test(mp)) return "hinge";
  if (/squat|knee/.test(mp)) return "squat";
  return "squat";
}

type PresetName = "squat" | "hinge" | "lunge" | "ohp" | "pushup" | "pull";

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
  const chinTuck = issues.some(i => /(tête|nuque|menton|projetée|cassée)/.test(i)) ? true : false;

  let kneesTrack: Guides["kneesTrack"] = "good";
  if (issues.some(i => /(valgus|genoux qui rentrent)/.test(i))) {
    kneesTrack = issues.some(i => /(élevée|forte|très)/.test(i)) ? "valgusStrong" : "valgusLight";
  }

  let feetAnchor: Guides["feetAnchor"] = "auto";
  if (issues.some(i => /(talons.*décollent|pieds instables)/.test(i))) feetAnchor = "heels";

  // cues explicites > fautes implicites
  const cue = (a.skeleton_cues || [])[0];
  if (cue?.spine?.neutral === true) { /* already neutral */ }
  if (cue?.head?.chin_tuck) kneesTrack = kneesTrack; // just to acknowledge
  if (cue?.feet?.anchor) {
    feetAnchor =
      cue.feet.anchor === "talons" ? "heels" :
      cue.feet.anchor === "milieu" ? "mid" :
      cue.feet.anchor === "avant" ? "fore" : "auto";
  }

  return { neutralSpine, chinTuck, kneesTrack, feetAnchor };
}

/* --------------- Dessins --------------- */

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, w, h);

  // plateau sol
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  const floorH = Math.round(h * 0.14);
  ctx.fillRect(0, h - floorH, w, floorH);

  // ligne horizon
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(h * 0.3));
  ctx.lineTo(w, Math.round(h * 0.3));
  ctx.stroke();
}

type Joint = { x: number; y: number };
type Pose = {
  head: Joint;
  neck: Joint;
  spineTop: Joint;
  spineBottom: Joint;
  hipL: Joint; hipR: Joint;
  kneeL: Joint; kneeR: Joint;
  ankleL: Joint; ankleR: Joint;
  shoulderL: Joint; shoulderR: Joint;
  elbowL: Joint; elbowR: Joint;
  wristL: Joint; wristR: Joint;
};

function drawGrayHuman(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
  preset: PresetName,
  guides: Guides
) {
  const cx = w * 0.5;
  const baseY = h * 0.82;
  const scale = Math.min(w, h) * 0.45;

  // Génère une pose selon preset+phase (de 0 à 1)
  const pose = generatePose(cx, baseY, scale, phase, preset, guides);

  // Ombre / base
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 8, scale * 0.45, scale * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Zone d’ancrage pieds (si demandé)
  if (guides.feetAnchor !== "auto") {
    ctx.fillStyle = "rgba(200,200,200,0.10)";
    const y = baseY;
    const width = scale * 0.55;
    const height = scale * 0.06;
    ctx.fillRect(cx - width / 2, y - height / 2, width, height);
    ctx.strokeStyle = "rgba(220,220,220,0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - width / 2, y - height / 2, width, height);
  }

  // Membres — silhouette grise
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

  // Tête (disque)
  ctx.fillStyle = "rgba(180,180,180,0.95)";
  ctx.beginPath();
  ctx.arc(pose.head.x, pose.head.y, scale * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Guides de correction (spine, knees, chin)
  drawGuides(ctx, pose, guides, scale);
}

function drawBone(ctx: CanvasRenderingContext2D, a: Joint, b: Joint) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/* --------------- Pose generator --------------- */

function generatePose(
  cx: number,
  baseY: number,
  s: number,
  phase: number,
  preset: PresetName,
  guides: Guides
): Pose {
  // paramètre de profondeur (0: lockout haut, 1: plus bas)
  const depth = easeInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);

  // offsets de base
  const hipWidth = s * 0.16;
  const shoulderWidth = s * 0.20;

  // Hauteur du buste (modulée par preset)
  const torsoLen =
    preset === "hinge" ? s * 0.42 :
    preset === "lunge" ? s * 0.43 :
    s * 0.45;

  // Profondeur du mouvement par preset
  const kneeBend =
    preset === "squat" ? mix(0.05, 0.65, depth) :
    preset === "lunge" ? mix(0.05, 0.60, depth) :
    preset === "hinge" ? mix(0.05, 0.35, depth) :
    preset === "pushup" ? mix(0.15, 0.55, depth) :
    preset === "ohp" || preset === "pull" ? mix(0.05, 0.20, depth) :
    mix(0.05, 0.5, depth);

  // Inclinaison du torse (hinge > squat)
  let torsoTilt =
    preset === "hinge" ? mix(0, Math.PI * 0.35, depth) :
    preset === "squat" ? mix(0, Math.PI * 0.18, depth) :
    preset === "lunge" ? mix(0, Math.PI * 0.2, depth) :
    preset === "pushup" ? Math.PI * 0.0 :
    preset === "ohp" || preset === "pull" ? 0 :
    0;

  // Neutral spine guide
  if (guides.neutralSpine) {
    // Limiter la cambrure excessive (réduire tilt)
    torsoTilt *= 0.8;
  }

  // Points principaux
  const spineBottom = { x: cx, y: baseY - s * (0.18 + kneeBend * 0.10) };
  const spineTop = { x: cx, y: spineBottom.y - torsoLen * Math.cos(torsoTilt) };
  const neck = { x: spineTop.x, y: spineTop.y - s * 0.06 };
  const head = { x: neck.x, y: neck.y - s * 0.10 };

  // Épaules
  const shoulderL = { x: spineTop.x - shoulderWidth / 2, y: spineTop.y };
  const shoulderR = { x: spineTop.x + shoulderWidth / 2, y: spineTop.y };

  // Hanches
  const hipL = { x: spineBottom.x - hipWidth / 2, y: spineBottom.y };
  const hipR = { x: spineBottom.x + hipWidth / 2, y: spineBottom.y };

  // Jambes (avec suivi genoux/pieds)
  const stance = s * 0.36;
  const ankleL = { x: cx - stance / 2, y: baseY };
  const ankleR = { x: cx + stance / 2, y: baseY };

  // Knees tracking (évite valgus, tire vers au-dessus du pied)
  const kneeSpread =
    guides.kneesTrack === "good" ? stance * 0.28 :
    guides.kneesTrack === "valgusLight" ? stance * 0.18 :
    stance * 0.10;

  const kneeDrop = s * (0.18 + kneeBend * 0.25);
  const kneeL = { x: cx - kneeSpread / 2, y: baseY - kneeDrop };
  const kneeR = { x: cx + kneeSpread / 2, y: baseY - kneeDrop };

  // Bras (position neutre selon preset)
  let elbowOffset = s * 0.16;
  let wristOffset = s * 0.16;
  if (preset === "ohp") {
    // overhead press : bras montent légèrement
    elbowOffset = s * 0.12;
  }
  const elbowL = { x: shoulderL.x - elbowOffset * 0.6, y: shoulderL.y + elbowOffset * 0.4 };
  const elbowR = { x: shoulderR.x + elbowOffset * 0.6, y: shoulderR.y + elbowOffset * 0.4 };
  const wristL = { x: elbowL.x - wristOffset * 0.5, y: elbowL.y + wristOffset * 0.3 };
  const wristR = { x: elbowR.x + wristOffset * 0.5, y: elbowR.y + wristOffset * 0.3 };

  // Chin tuck léger (tête reculée de qq px)
  if (guides.chinTuck) {
    head.x = head.x * 0.98 + neck.x * 0.02;
    head.y = head.y * 1.0;
  }

  return { head, neck, spineTop, spineBottom, hipL, hipR, kneeL, kneeR, ankleL, ankleR, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR };
}

/* --------------- Guides visuels --------------- */

function drawGuides(ctx: CanvasRenderingContext2D, pose: Pose, guides: Guides, s: number) {
  // Ligne de neutralité de la colonne (verticale)
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

  // Genoux suivent les pieds (flèches vers l’extérieur)
  if (guides.kneesTrack !== "good") {
    const color = guides.kneesTrack === "valgusLight" ? "#FFD266" : "#FF7C7C";
    arrow(ctx, pose.kneeL.x, pose.kneeL.y, pose.kneeL.x - s * 0.10, pose.kneeL.y, color);
    arrow(ctx, pose.kneeR.x, pose.kneeR.y, pose.kneeR.x + s * 0.10, pose.kneeR.y, color);
    drawTag(ctx, pose.kneeR.x + s * 0.12, pose.kneeR.y - s * 0.06, "Pousse les genoux vers l’extérieur");
  } else {
    // petit check “OK”
    check(ctx, (pose.kneeL.x + pose.kneeR.x) / 2, pose.kneeL.y - s * 0.12, "#9EF79E");
  }

  // Chin tuck (flèche arrière)
  if (guides.chinTuck) {
    arrow(ctx, pose.head.x + s * 0.08, pose.head.y, pose.head.x - s * 0.02, pose.head.y, "#FFC97C");
    drawTag(ctx, pose.head.x + s * 0.10, pose.head.y + s * 0.04, "Rentre légèrement le menton");
  }

  // Ancrage pieds
  if (guides.feetAnchor !== "auto") {
    const txt =
      guides.feetAnchor === "heels" ? "Poids sur talons/milieu" :
      guides.feetAnchor === "mid" ? "Poids milieu du pied" :
      "Poids avant-pied";
    drawTag(ctx, (pose.ankleR.x + pose.ankleL.x) / 2 + s * 0.14, pose.ankleR.y - s * 0.06, txt);
  }
}

/* --------------- Primitives dessin --------------- */

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
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
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
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
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

/* --------------- Maths helpers --------------- */
function mix(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function labelize(s: string) {
  const x = s.trim();
  return x.charAt(0).toUpperCase() + x.slice(1);
}
