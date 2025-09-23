// apps/web/components/SkeletonCoach.tsx
"use client";
import React, { useEffect, useRef } from "react";

export type Fault = { issue: string; severity: "faible"|"moyenne"|"élevée"; evidence?: string; correction?: string };
export type AIAnalysis = {
  exercise: string;
  overall: string;
  muscles: string[];
  corrections: string[];
  faults?: Fault[];
  extras?: string[];
  timeline: { time: number; label: string; detail?: string }[];
  objects?: string[];
  movement_pattern?: string;
  rawText?: string;
};

/**
 * SkeletonCoach – génère une "vidéo" squelette (canvas animé) qui illustre
 * ce qu'il faut corriger: colonne neutre, genoux alignés, tête, appuis.
 *
 * UX: on affiche deux personnages:
 *  - gauche: "Avant" (erreurs détectées, en rouge)
 *  - droite: "Après" (correction attendue, en vert)
 */
export default function SkeletonCoach({
  analysis,
  height = 360,
}: {
  analysis: AIAnalysis | null;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const draw = (ctx: CanvasRenderingContext2D, t: number, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    // fond
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // légendes haut
    ctx.font = "600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText("Avant (erreurs)", Math.round(width*0.18) - 60, 24);
    ctx.fillStyle = "#c7f9cc";
    ctx.fillText("Après (correction)", Math.round(width*0.82) - 68, 24);

    // sol
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, height - 28);
    ctx.lineTo(width - 20, height - 28);
    ctx.stroke();

    // Zones d'animation
    const L = { cx: Math.round(width*0.25), base: height - 28 };
    const R = { cx: Math.round(width*0.75), base: height - 28 };

    const faults = (analysis?.faults || []).map(f => f.issue.toLowerCase());
    const has = (re: RegExp) => faults.some(i => re.test(i));

    // Paramètres "avant" (avec erreurs exagérées)
    const A = {
      squatDepth: 0.85,                            // 0..1
      kneeValgus: has(/genou.*rentr|valgus/) ? 0.35 : 0.0, // 0..0.5
      kneeLock: has(/jambes? (trop )?tend|verrouill/) ? 1 : 0,
      spineCurve: has(/dos.*cambr|lordose|ant[ée]version/) ? 0.28 : 0.08, // courbure
      headTilt: has(/t[êe]te|nuque|cou/) ? 0.25 : 0.05,
      heelLift: has(/talons? qui se d[ée]coll/) ? 0.3 : 0.0,
      tempo: 1.2,
    } as const;

    // Paramètres "après" (corrections)
    const B = {
      squatDepth: 0.85,
      kneeValgus: 0.0,
      kneeLock: 0,
      spineCurve: 0.04,
      headTilt: 0.02,
      heelLift: 0.0,
      tempo: 1.0,
    } as const;

    const cycle = Math.sin((t/1000) * Math.PI * (analysis?.movement_pattern?.includes("tempo") ? 0.8 : 1));
    const phase = (cycle + 1) / 2; // 0..1

    drawStickSquat(ctx, L.cx, L.base, phase, A, { color: "#f87171" });
    drawStickSquat(ctx, R.cx, R.base, phase, B, { color: "#34d399" });

    // Tips dynamiques à droite (corrections synthétiques)
    const tips = collectTips(analysis);
    drawTips(ctx, width - 260, 56, tips);

    // Titre
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "700 15px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const title = analysis?.exercise ? `Exercice: ${analysis.exercise}` : "Exercice: inconnu";
    ctx.fillText(title, 20, 24);
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rectW = Math.max(640, c.parentElement?.clientWidth || 640);
    const ratio = 16/9;
    c.width = Math.round(rectW);
    c.height = Math.round(rectW/ratio);

    const ctx = c.getContext("2d");
    if (!ctx) return;

    const loop = (t: number) => {
      draw(ctx, t, c.width, c.height);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [analysis]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border" style={{ aspectRatio: "16 / 9" }}>
      <canvas ref={canvasRef} className="block w-full h-auto" />
    </div>
  );
}

// --------------- Helpers dessin ---------------
function drawTips(ctx: CanvasRenderingContext2D, x: number, y: number, tips: string[]) {
  const W = 240; const pad = 10; const lineH = 18;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x, y, W, Math.min(6, tips.length) * lineH + 2*pad + 16);
  ctx.fillStyle = "#fff";
  ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Corrections clés", x + pad, y + 14);
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  tips.slice(0,6).forEach((t, i) => {
    ctx.fillText("• " + t, x + pad, y + 16 + pad + (i+1)*lineH - 6);
  });
}

function collectTips(a: AIAnalysis | null): string[] {
  if (!a) return ["Gaine le tronc", "Fléchis légèrement les genoux", "Garde les genoux alignés", "Ancre les talons"];
  const base = (a.faults || []).map(f => (f.correction || "").trim()).filter(Boolean);
  if (base.length) return base;
  return (a.corrections || []).slice(0,6);
}

function drawStickSquat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  phase: number, // 0..1 (descente -> montée)
  P: { squatDepth: number; kneeValgus: number; kneeLock: number; spineCurve: number; headTilt: number; heelLift: number; tempo: number; },
  opts: { color: string }
) {
  const color = opts.color;
  const scale = 1; // placeholder pour zoom

  // hauteur du centre de masse suivant la phase (descente/montee)
  const depth = P.squatDepth * (phase < 0.5 ? (phase*2) : (1-(phase-0.5)*2)); // va 0->depth->0
  const hipsY = baseY - 120 + -40*depth;

  // points clés (2D)
  const footSpan = 44;
  const footLeft = { x: cx - footSpan, y: baseY - (P.heelLift>0? P.heelLift*18:0) };
  const footRight= { x: cx + footSpan, y: baseY - (P.heelLift>0? P.heelLift*18:0) };

  const kneeOffset = 26;
  const kneeSigma = P.kneeValgus * 22; // valgus -> genoux qui rentrent
  const kneeLeft = { x: cx - kneeOffset + kneeSigma, y: baseY - 60 + -25*depth };
  const kneeRight= { x: cx + kneeOffset - kneeSigma, y: baseY - 60 + -25*depth };

  const hipLeft  = { x: cx - 12, y: hipsY };
  const hipRight = { x: cx + 12, y: hipsY };
  const hipMid   = { x: cx, y: hipsY };

  // colonne (spineCurve: cambrure)
  const spineTop = { x: cx, y: hipsY - 50 };
  const spineCtl = { x: cx + P.spineCurve*26, y: hipsY - 25 };

  // épaules et tête
  const shoulderL = { x: cx - 20, y: spineTop.y };
  const shoulderR = { x: cx + 20, y: spineTop.y };
  const head = { x: cx + P.headTilt*12, y: spineTop.y - 16 };

  // bras (option simple, statiques)
  const elbowL = { x: shoulderL.x - 12, y: shoulderL.y + 10 };
  const elbowR = { x: shoulderR.x + 12, y: shoulderR.y + 10 };
  const handL = { x: elbowL.x - 10, y: elbowL.y + 10 };
  const handR = { x: elbowR.x + 10, y: elbowR.y + 10 };

  // Style
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;

  // jambes
  line(ctx, footLeft, kneeLeft);
  line(ctx, footRight, kneeRight);
  line(ctx, kneeLeft, hipLeft);
  line(ctx, kneeRight, hipRight);

  // bassin (petite ligne)
  line(ctx, hipLeft, hipRight);

  // colonne en courbe
  bezier(ctx, hipMid, spineCtl, spineTop);

  // épaules + bras
  line(ctx, shoulderL, shoulderR);
  line(ctx, shoulderL, elbowL); line(ctx, elbowL, handL);
  line(ctx, shoulderR, elbowR); line(ctx, elbowR, handR);

  // tête
  circle(ctx, head, 8, color);

  // repères (seulement pour la version "avant")
  if (color === "#f87171") {
    // genoux qui rentrent
    if (P.kneeValgus > 0.05) {
      hint(ctx, cx + 54, kneeLeft.y - 14, "Genoux rentrent");
      arrow(ctx, {x: kneeLeft.x+8, y: kneeLeft.y-10}, {x: cx- kneeOffset, y: kneeLeft.y-10});
      arrow(ctx, {x: kneeRight.x-8, y: kneeRight.y-10}, {x: cx+ kneeOffset, y: kneeRight.y-10});
    }
    // cambrure
    if (P.spineCurve > 0.08) {
      hint(ctx, cx + 46, spineTop.y - 32, "Dos trop cambré");
    }
    // talons
    if (P.heelLift > 0.05) {
      hint(ctx, cx + 40, baseY - 44, "Talons décollés");
    }
  } else {
    // conseils "après"
    hint(ctx, cx + 42, kneeLeft.y - 16, "Genoux vers orteils");
    hint(ctx, cx + 42, spineTop.y - 32, "Gaine / neutre");
    hint(ctx, cx + 42, baseY - 44, "Talons ancrés");
  }
}

// primitives
function line(ctx: CanvasRenderingContext2D, a: {x:number;y:number}, b: {x:number;y:number}) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function bezier(ctx: CanvasRenderingContext2D, a: {x:number;y:number}, c: {x:number;y:number}, b: {x:number;y:number}) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y); ctx.stroke();
}
function circle(ctx: CanvasRenderingContext2D, p:{x:number;y:number}, r:number, color:string) {
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill();
}
function hint(ctx: CanvasRenderingContext2D, x:number, y:number, text:string) {
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x, y, ctx.measureText(text).width+12, 22);
  ctx.fillStyle = "#fff"; ctx.font = "12px system-ui, -apple-system"; ctx.fillText(text, x+6, y+15);
}
function arrow(ctx: CanvasRenderingContext2D, a:{x:number;y:number}, b:{x:number;y:number}) {
  const head = 8; const dx=b.x-a.x, dy=b.y-a.y; const ang = Math.atan2(dy,dx);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - head*Math.cos(ang-Math.PI/6), b.y - head*Math.sin(ang-Math.PI/6));
  ctx.lineTo(b.x - head*Math.cos(ang+Math.PI/6), b.y - head*Math.sin(ang+Math.PI/6));
  ctx.closePath(); ctx.fillStyle = ctx.strokeStyle as string; ctx.fill();
}

// -------------------------------------------------------------
// Patchs de page.tsx – remplacer l'aperçu vidéo par la vidéo "squelette"
// -------------------------------------------------------------
// 1) Ajouter l'import:
// import SkeletonCoach from "@/components/SkeletonCoach";
//
// 2) Dans la section "Démonstration — aperçu corrigé par l’IA",
//    remplacer <VideoWithOverlay .../> par:
//
// {analysis ? (
//   <div className="space-y-2">
//     <SkeletonCoach analysis={analysis} />
//     <p className="text-xs text-muted-foreground">Cette animation illustre la posture à viser d'après l'analyse de tes images, sans afficher ta vidéo.</p>
//   </div>
// ) : (
//   <div className="text-sm text-muted-foreground">
//     Aucune analyse. Enregistre ou importe un clip pour lancer l’analyse et voir l’animation squelette.
//   </div>
// )}
//
// 3) (optionnel) tu peux masquer totalement le player d'origine en supprimant VideoWithOverlay.
//    L'upload reste utilisé uniquement pour extraire des mosaïques et nourrir /api/analyze.
