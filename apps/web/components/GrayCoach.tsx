// apps/web/components/GrayCoach.tsx
"use client";

import { useEffect, useRef } from "react";

/** Types alignés avec ton backend */
type Fault = { issue: string; severity: "faible"|"moyenne"|"élevée"; evidence?: string; correction?: string };
type AnalysisPoint = { time: number; label: string; detail?: string };
type SkeletonCue = {
  phase?: "setup"|"descente"|"bas"|"montée"|"lockout";
  spine?: { neutral?: boolean; tilt_deg?: number };
  knees?: { valgus_level?: 0|1|2; should_bend?: boolean };
  head?: { chin_tuck?: boolean };
  feet?: { anchor?: "talons"|"milieu"|"avant"; unstable?: boolean };
  notes?: string;
};
export interface AIAnalysis {
  exercise: string;
  overall: string;
  muscles: string[];
  corrections: string[];
  faults?: Fault[];
  extras?: string[];
  timeline: AnalysisPoint[];
  objects?: string[];
  movement_pattern?: string;
  rawText?: string;
  skeleton_cues?: SkeletonCue[];
}

/**
 * GrayCoach
 * - Dessine une silhouette humaine grise (pas un stickman) avec segments pleins arrondis
 * - Joue un cycle "corrigé" du mouvement en fonction de analysis.exercise + faults/skeleton_cues
 * - Ne lit jamais la vidéo — juste les données d'analyse
 */
export default function GrayCoach({ analysis, height = 360 }: { analysis: AIAnalysis; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const c = canvasRef.current!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.round((height * 16) / 9);
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(height * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${height}px`;

    const ctx = c.getContext("2d")!;
    // scale for HiDPI
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let t0 = performance.now();

    const loop = (now: number) => {
      const dt = (now - t0) / 1000;
      t0 = now;
      drawFrame(ctx, c.width / dpr, c.height / dpr, analysis, dt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [analysis, height]);

  return (
    <div className="relative w-full">
      <canvas ref={canvasRef} className="w-full rounded-2xl border bg-[radial-gradient(circle_at_30%_20%,rgba(0,0,0,0.06),transparent_60%)]" />
      <Legend analysis={analysis} />
    </div>
  );
}

/* ----------------------- Dessin & Animation ----------------------- */

type Pose = {
  hipY: number;               // profondeur de squat (0=tendu, 1=très bas)
  torsoTilt: number;          // radians (positif = incliné vers l'avant)
  headTilt: number;           // radians (positif = menton sorti)
  kneeAngleL: number;         // radians (π = jambe tendue)
  kneeAngleR: number;
  ankleAngleL: number;        // pour suggérer talon au sol
  ankleAngleR: number;
  stance: number;             // écartement pieds (0..1)
  kneeTrack: number;          // genoux alignés sur pieds : 0=genoux serrés, 1=au-dessus des orteils (correct)
};

function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, a: AIAnalysis, dt: number) {
  // bg
  ctx.clearRect(0, 0, W, H);
  // sol
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, H - 18, W, 18);

  // état animé 0..1 (rythme doux)
  const cycle = 2.2; // secondes
  const t = (performance.now() / 1000 / cycle) % 1;

  const exo = normalizeExercise(a.exercise);
  const cues = reduceCues(a);
  const faults = (a.faults || []).map(f => f.issue.toLowerCase());

  // Pose corrigée cible en fonction de l’exercice + indices
  const target = correctedTargetPose(exo, faults, cues);

  // Animation sinusoïdale sur 4 phases (descente/pauses/montée)
  const phase = smoothStep(triangleWave(t)); // 0..1..0
  const pose = poseAlongPhase(target, phase);

  drawSilhouette(ctx, W, H, pose);
  drawHelpers(ctx, W, H, pose, faults);
}

/* ----------------------- Poses ----------------------- */

function correctedTargetPose(exo: string, faults: string[], cues: ReturnType<typeof reduceCues>): Pose {
  // Defaults = squat polyvalent “propre”
  let hipY = 0.55;            // profondeur (0..1)
  let torsoTilt = deg(20);    // légère inclinaison tronc
  let kneeAngle = deg(110);   // ~110° au plus bas
  let ankle = deg(75);        // cheville fléchie (talon au sol)
  let stance = 0.55;          // écartement moyen
  let kneeTrack = 0.75;       // genoux suivent l’axe des orteils

  if (/deadlift|soulevé/.test(exo)) {
    hipY = 0.45;
    torsoTilt = deg(30);
    kneeAngle = deg(150);     // jambes plus “longues” qu’un squat
    ankle = deg(85);
    stance = 0.5;
    kneeTrack = 0.65;
  } else if (/push.?up|pompe/.test(exo)) {
    hipY = 0.15;
    torsoTilt = deg(0);
    kneeAngle = deg(175);
    ankle = deg(90);
    stance = 0.45;
    kneeTrack = 0.7;
  }

  // Corrections guidées par faults
  if (faults.some(x => /lordose|dos trop cambr|bassin/.test(x))) {
    torsoTilt = clamp(torsoTilt, deg(10), deg(25)); // garder neutre/modéré
  }
  if (faults.some(x => /genoux.*rentr|valgus/.test(x))) {
    kneeTrack = 0.9; // forcer genoux “au-dessus des orteils”
    stance = Math.max(stance, 0.55);
  }
  if (faults.some(x => /jambes.*tendues|verrouill/.test(x))) {
    kneeAngle = Math.min(kneeAngle, deg(150)); // éviter lockout complet
  }
  if (faults.some(x => /talons?.*décoll/.test(x))) {
    ankle = deg(85); // talons au sol ⇒ cheville ouverte
  }
  if (faults.some(x => /tête|nuque|menton/.test(x))) {
    // menton rentré (headTilt vers 0)
  }

  // Intégrer cues si présents
  if (cues.tilt_deg !== undefined) torsoTilt = deg(clamp(cues.tilt_deg, 5, 35));
  if (cues.valgus_level !== undefined && cues.valgus_level > 0) {
    kneeTrack = 0.9; stance = Math.max(stance, 0.6);
  }
  if (cues.chin_tuck) {
    // forcer tête neutre
  }

  return {
    hipY,
    torsoTilt,
    headTilt: 0,
    kneeAngleL: kneeAngle,
    kneeAngleR: kneeAngle,
    ankleAngleL: ankle,
    ankleAngleR: ankle,
    stance,
    kneeTrack,
  };
}

function poseAlongPhase(target: Pose, phase: number): Pose {
  // phase 0 ➜ haut ; 1 ➜ bas (ou inverse selon exo)
  const depth = 0.15 + 0.85 * phase; // accentue la descente
  return {
    ...target,
    hipY: lerp(0.18, target.hipY, depth),
    kneeAngleL: lerp(deg(175), target.kneeAngleL, depth),
    kneeAngleR: lerp(deg(175), target.kneeAngleR, depth),
    ankleAngleL: lerp(deg(90), target.ankleAngleL, depth),
    ankleAngleR: lerp(deg(90), target.ankleAngleR, depth),
    torsoTilt: lerp(deg(5), target.torsoTilt, depth),
    headTilt: lerp(0, 0, depth),
  };
}

/* ----------------------- Silhouette ----------------------- */

function drawSilhouette(ctx: CanvasRenderingContext2D, W: number, H: number, p: Pose) {
  // Espace de travail
  const cx = W * 0.5;
  const baseY = H * 0.82;

  // dimensions relatives
  const bodyH = H * 0.55;
  const pelvisW = W * (0.12 + 0.08 * (p.stance - 0.5)); // varie un peu avec stance
  const thighL = bodyH * 0.28;
  const shinL = bodyH * 0.28;
  const torsoL = bodyH * 0.32;
  const neckL = bodyH * 0.06;
  const headR = bodyH * 0.08;
  const shoulderW = pelvisW * 1.2;

  // pieds (ancrage large ou moyen)
  const feetHalf = W * (0.12 + 0.12 * (p.stance - 0.5));
  const footLx = cx - feetHalf;
  const footRx = cx + feetHalf;
  const footY = baseY;

  // genoux “alignés sur orteils” (kneeTrack) => x décalé vers l’extérieur
  const kneeOffset = feetHalf * (p.kneeTrack - 0.5) * 0.9;

  // cinématique 2D simplifiée (plan sagittal + léger décalage frontal)
  // hanches
  const hipY = baseY - (torsoL + thighL * Math.cos(p.kneeAngleL - Math.PI) + shinL * Math.cos(p.kneeAngleL - Math.PI)) * (0.55 + 0.35 * p.hipY);
  const hipLx = cx - pelvisW * 0.5;
  const hipRx = cx + pelvisW * 0.5;

  // genoux
  const kneeLy = hipY + thighL * Math.cos(p.kneeAngleL);
  const kneeLx = hipLx - kneeOffset * 0.7;
  const kneeRy = hipY + thighL * Math.cos(p.kneeAngleR);
  const kneeRx = hipRx + kneeOffset * 0.7;

  // chevilles (projeter vers les pieds)
  const ankleLy = footY;
  const ankleLx = footLx;
  const ankleRy = footY;
  const ankleRx = footRx;

  // torse (part de milieu du bassin)
  const pelvisCx = (hipLx + hipRx) / 2;
  const pelvisCy = hipY;
  const torsoEndX = pelvisCx + torsoL * Math.sin(p.torsoTilt);
  const torsoEndY = pelvisCy - torsoL * Math.cos(p.torsoTilt);

  // épaules (barre imaginaire)
  const shLx = torsoEndX - shoulderW * 0.5;
  const shRx = torsoEndX + shoulderW * 0.5;
  const shY = torsoEndY;

  // cou + tête
  const neckEndX = torsoEndX;
  const neckEndY = shY - neckL;
  const headCx = neckEndX;
  const headCy = neckEndY - headR;

  // MATERIAUX
  const fill = "#bfbfbf";              // gris “personne”
  const stroke = "rgba(0,0,0,0.12)";

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // pieds
  ctx.fillStyle = fill;
  drawFoot(ctx, footLx, footY, W * 0.11, H * 0.02);
  drawFoot(ctx, footRx, footY, W * 0.11, H * 0.02);

  // tibias
  drawLimb(ctx, kneeLx, kneeLy, ankleLx, ankleLy, W * 0.035, fill, stroke);
  drawLimb(ctx, kneeRx, kneeRy, ankleRx, ankleRy, W * 0.035, fill, stroke);

  // cuisses
  drawLimb(ctx, hipLx, hipY, kneeLx, kneeLy, W * 0.045, fill, stroke);
  drawLimb(ctx, hipRx, hipY, kneeRx, kneeRy, W * 0.045, fill, stroke);

  // bassin (capsule)
  drawCapsule(ctx, hipLx, hipY, hipRx, hipY, W * 0.07, fill, stroke);

  // torse
  drawLimb(ctx, pelvisCx, pelvisCy, torsoEndX, torsoEndY, W * 0.06, fill, stroke);

  // bras (décontractés, légèrement vers l’avant)
  const armL = bodyH * 0.25;
  const foreL = bodyH * 0.22;
  const elbowLx = shLx - armL * 0.15;
  const elbowLy = shY + armL * 0.55;
  const handLx = elbowLx + foreL * 0.3;
  const handLy = elbowLy + foreL * 0.75;
  drawLimb(ctx, shLx, shY, elbowLx, elbowLy, W * 0.03, fill, stroke);
  drawLimb(ctx, elbowLx, elbowLy, handLx, handLy, W * 0.028, fill, stroke);

  const elbowRx = shRx + armL * 0.15;
  const elbowRy = shY + armL * 0.55;
  const handRx = elbowRx - foreL * 0.3;
  const handRy = elbowRy + foreL * 0.75;
  drawLimb(ctx, shRx, shY, elbowRx, elbowRy, W * 0.03, fill, stroke);
  drawLimb(ctx, elbowRx, elbowRy, handRx, handRy, W * 0.028, fill, stroke);

  // cou & tête
  drawLimb(ctx, torsoEndX, torsoEndY, neckEndX, neckEndY, W * 0.03, fill, stroke);
  ctx.beginPath();
  ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

/* ----------------------- Aides visuelles légères ----------------------- */
function drawHelpers(ctx: CanvasRenderingContext2D, W: number, H: number, p: Pose, faults: string[]) {
  // zone d’ancrage au sol
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  const pad = W * 0.2;
  ctx.fillRect(pad, H - 22, W - 2 * pad, 6);

  // tips discrets
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const tips: string[] = [];
  if (faults.some(x => /genoux.*rentr|valgus/.test(x))) tips.push("Genoux suivent orteils");
  if (faults.some(x => /talons?.*décoll/.test(x))) tips.push("Talons ancrés");
  if (faults.some(x => /lordose|dos trop cambr|bassin/.test(x))) tips.push("Gaine & dos neutre");
  if (tips.length) {
    const txt = tips.join(" • ");
    const w = ctx.measureText(txt).width + 16;
    ctx.fillRect(12, 12, w, 24);
    ctx.fillStyle = "#fff";
    ctx.fillText(txt, 20, 29);
  }
}

/* ----------------------- Primitives de dessin ----------------------- */
function drawLimb(ctx: CanvasRenderingContext2D, x1:number,y1:number,x2:number,y2:number, thick:number, fill:string, stroke:string) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;
  drawCapsule(ctx, x1, y1, x2, y2, thick, fill, stroke);
}

function drawCapsule(ctx: CanvasRenderingContext2D, x1:number,y1:number,x2:number,y2:number, r:number, fill:string, stroke:string) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const rx = -uy * r * 0.5, ry = ux * r * 0.5;
  ctx.beginPath();
  ctx.moveTo(x1 + rx, y1 + ry);
  ctx.lineTo(x2 + rx, y2 + ry);
  ctx.arcTo(x2 + rx, y2 + ry, x2 - rx, y2 - ry, r);
  ctx.lineTo(x2 - rx, y2 - ry);
  ctx.arcTo(x2 - rx, y2 - ry, x1 - rx, y1 - ry, r);
  ctx.lineTo(x1 - rx, y1 - ry);
  ctx.arcTo(x1 - rx, y1 - ry, x1 + rx, y1 + ry, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawFoot(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number) {
  const r = h * 0.9;
  ctx.beginPath();
  ctx.moveTo(x - w/2 + r, y);
  ctx.lineTo(x + w/2 - r, y);
  ctx.quadraticCurveTo(x + w/2, y, x + w/2, y - r);
  ctx.lineTo(x + w/2, y - h + r);
  ctx.quadraticCurveTo(x + w/2, y - h, x + w/2 - r, y - h);
  ctx.lineTo(x - w/2 + r, y - h);
  ctx.quadraticCurveTo(x - w/2, y - h, x - w/2, y - h + r);
  ctx.lineTo(x - w/2, y - r);
  ctx.quadraticCurveTo(x - w/2, y, x - w/2 + r, y);
  ctx.closePath();
  ctx.fill();
}

/* ----------------------- Utils ----------------------- */
function normalizeExercise(s: string) {
  const x = (s || "").toLowerCase();
  if (/front/.test(x)) return "front squat";
  if (/squat/.test(x)) return "squat";
  if (/dead|soulev/.test(x)) return "deadlift";
  if (/push.?up|pompe/.test(x)) return "push-up";
  return "generic";
}
function reduceCues(a: AIAnalysis) {
  const cues = a.skeleton_cues?.[0] || {};
  return {
    tilt_deg: cues.spine?.tilt_deg,
    valgus_level: cues.knees?.valgus_level,
    chin_tuck: cues.head?.chin_tuck,
  };
}
function deg(x: number) { return (x * Math.PI) / 180; }
function clamp(v:number, a:number, b:number){ return Math.min(b, Math.max(a, v)); }
function lerp(a:number,b:number,t:number){ return a + (b - a) * t; }
function triangleWave(t:number){ t = t % 1; return t < 0.5 ? t*2 : (1 - t)*2; }
function smoothStep(x:number){ return x*x*(3 - 2*x); }

/* ----------------------- Légende ----------------------- */
function Legend({ analysis }: { analysis: AIAnalysis }) {
  const issues = (analysis.faults || []).map(f => f.issue).filter(Boolean);
  const corr = (analysis.faults || [])
    .map(f => f.correction)
    .filter(Boolean);
  return (
    <div className="mt-3 space-y-1">
      <div className="text-sm">
        <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-2 py-1">
          <span className="h-3 w-3 rounded-full bg-neutral-400 inline-block" />
          <span>Silhouette corrigée — {analysis.exercise || "exercice"}</span>
        </span>
      </div>
      {issues.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Erreurs corrigées : {issues.join(" · ")}
        </p>
      )}
      {corr.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Focales : {corr.join(" · ")}
        </p>
      )}
    </div>
  );
}
