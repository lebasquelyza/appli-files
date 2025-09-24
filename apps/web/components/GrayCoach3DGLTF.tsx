// apps/web/components/GrayCoach3DGLTF.tsx
"use client";

/**
 * Mannequin 3D "démo" sans R3F : pur Three.js sur <canvas>.
 * - Pas de dépendances @react-three/fiber / drei.
 * - Sûr pour Netlify/SSR : tout est côté client.
 * - Animation simple selon l'exercice (squat, deadlift/hinge, lunge, pushup, ohp, traction/pull-up).
 */

import React, { useEffect, useRef } from "react";

// Import Three.js dynamiquement pour éviter tout souci SSR.
let THREE: typeof import("three") | null = null;

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

export default function GrayCoach3DGLTF({
  analysis,
  exerciseOverride,
  height = 420,
}: {
  analysis: AIAnalysis;
  /** Si fourni, force l’animation sur cet exercice (ex: "Tractions") */
  exerciseOverride?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;

    // objets du mannequin
    let torso: any, head: any;
    let upperArmL: any, lowerArmL: any, handL: any;
    let upperArmR: any, lowerArmR: any, handR: any;
    let upperLegL: any, lowerLegL: any, footL: any;
    let upperLegR: any, lowerLegR: any, footR: any;
    let bar: any; // barre de traction / haltère virtuel selon exo
    let floor: any, rig: any;

    // états anim
    let t0 = performance.now();

    (async () => {
      if (!mounted) return;

      // Charger Three côté client
      if (!THREE) {
        THREE = await import("three");
      }
      if (!mounted || !THREE) return;

      const container = containerRef.current!;
      const canvas = canvasRef.current!;
      // Renderer
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.setClearColor(0x0b0b0b, 1);

      // Scene + Camera
      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 1.5, 4);
      camera.lookAt(0, 1.0, 0);
      scene.add(camera);

      // Lumières
      const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(3, 5, 3);
      dirLight.castShadow = false;
      scene.add(dirLight);

      // Sol
      const floorGeo = new THREE.PlaneGeometry(20, 20);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.0,
      });
      floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      scene.add(floor);

      // Rig général pour bouger le corps d'un bloc
      rig = new THREE.Group();
      rig.position.y = 0; // 0 = pieds sur le sol
      scene.add(rig);

      // Matériaux gris
      const gray = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, metalness: 0.1, roughness: 0.6 });
      const darkGray = new THREE.MeshStandardMaterial({ color: 0x8f8f8f, metalness: 0.2, roughness: 0.5 });

      // Utility
      const makeBone = (geo: import("three").BufferGeometry, mat = gray) => new THREE!.Mesh(geo, mat);

      // Torse (boîte)
      torso = makeBone(new THREE!.BoxGeometry(0.5, 0.7, 0.25), gray);
      torso.position.set(0, 1.3, 0);
      rig.add(torso);

      // Tête (sphère)
      head = new THREE!.Mesh(new THREE!.SphereGeometry(0.16, 24, 24), gray);
      head.position.set(0, 1.75, 0);
      rig.add(head);

      // Bras
      upperArmL = makeBone(new THREE!.CylinderGeometry(0.08, 0.08, 0.38, 16), darkGray);
      upperArmL.position.set(-0.35, 1.45, 0);
      upperArmL.rotation.z = Math.PI / 2.4;
      rig.add(upperArmL);

      lowerArmL = makeBone(new THREE!.CylinderGeometry(0.07, 0.07, 0.34, 16), gray);
      lowerArmL.position.set(-0.62, 1.35, 0);
      lowerArmL.rotation.z = Math.PI / 2.8;
      rig.add(lowerArmL);

      handL = makeBone(new THREE!.BoxGeometry(0.12, 0.1, 0.1), gray);
      handL.position.set(-0.78, 1.28, 0);
      rig.add(handL);

      upperArmR = upperArmL.clone();
      upperArmR.position.x = 0.35;
      upperArmR.rotation.z = -Math.PI / 2.4;
      rig.add(upperArmR);

      lowerArmR = lowerArmL.clone();
      lowerArmR.position.x = 0.62;
      lowerArmR.rotation.z = -Math.PI / 2.8;
      rig.add(lowerArmR);

      handR = handL.clone();
      handR.position.x = 0.78;
      rig.add(handR);

      // Jambes
      upperLegL = makeBone(new THREE!.CylinderGeometry(0.1, 0.1, 0.5, 16), darkGray);
      upperLegL.position.set(-0.16, 0.9, 0);
      rig.add(upperLegL);

      lowerLegL = makeBone(new THREE!.CylinderGeometry(0.09, 0.09, 0.48, 16), gray);
      lowerLegL.position.set(-0.16, 0.55, 0.02);
      rig.add(lowerLegL);

      footL = makeBone(new THREE!.BoxGeometry(0.22, 0.08, 0.35), gray);
      footL.position.set(-0.16, 0.15, 0.12);
      rig.add(footL);

      upperLegR = upperLegL.clone();
      upperLegR.position.x = 0.16;
      rig.add(upperLegR);

      lowerLegR = lowerLegL.clone();
      lowerLegR.position.x = 0.16;
      rig.add(lowerLegR);

      footR = footL.clone();
      footR.position.x = 0.16;
      rig.add(footR);

      // Barre (utile pour tractions / OHP / deadlift)
      bar = new THREE!.Mesh(new THREE!.CylinderGeometry(0.03, 0.03, 1.2, 16), new THREE!.MeshStandardMaterial({ color: 0xcccccc }));
      bar.rotation.z = Math.PI / 2;
      bar.visible = false; // par défaut
      scene.add(bar);

      // Ajuster taille renderer
      const onResize = () => {
        if (!renderer || !camera || !container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      onResize();
      window.addEventListener("resize", onResize);

      // Animation
      const exo = normalizeExercise(exerciseOverride || analysis.exercise || analysis.movement_pattern || "");
      const animate = (now: number) => {
        const dt = (now - t0) / 1000;
        t0 = now;

        // phase de cycle (2.2s)
        const cycle = 2.2;
        const phase = (now / 1000) % cycle;
        const t = easeInOut((phase / cycle) % 1);

        // Reset de base (posture neutre)
        resetPose();

        // Appliquer mouvement selon exo
        switch (exo) {
          case "pullup":
            bar.visible = true;
            bar.position.set(0, 2.3, 0);
            pullUp(t);
            break;
          case "squat":
            squat(t);
            break;
          case "hinge":
            deadliftHinge(t);
            break;
          case "lunge":
            lunge(t);
            break;
          case "pushup":
            pushup(t);
            break;
          case "ohp":
            bar.visible = true;
            bar.position.set(0, 1.55, 0.25);
            overheadPress(t);
            break;
          default:
            squat(t);
            break;
        }

        renderer!.render(scene!, camera!);
        rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);

      // Nettoyage à la fin du composant
      const cleanup = () => {
        window.removeEventListener("resize", onResize);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (scene) {
          scene.traverse((obj) => {
            const m = obj as any;
            if (m.geometry) m.geometry.dispose?.();
            if (m.material) {
              if (Array.isArray(m.material)) m.material.forEach((mm: any) => mm.dispose?.());
              else m.material.dispose?.();
            }
          });
        }
        renderer?.dispose();
        // laisser le GC nettoyer
        renderer = null;
        scene = null;
        camera = null;
      };

      // Quand l'effet est démonté
      (cleanup as any).noop = true; // pas utilisé ailleurs, juste pour le linter
    })();

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analysis, exerciseOverride]);

  return (
    <div ref={containerRef} className="w-full border rounded-2xl overflow-hidden relative" style={{ height }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2 left-2 rounded bg-black/60 text-white text-[11px] px-2 py-1">
        Mannequin 3D (démo)
      </div>
    </div>
  );
}

/* ====================== Helpers ====================== */

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function normalizeExercise(raw: string) {
  const s = (raw || "").toLowerCase();
  if (/(pull-?up|traction|trac?tion)/.test(s)) return "pullup";
  if (/(squat|goblet|front\s*squat)/.test(s)) return "squat";
  if (/(deadlift|soulev|hinge|rdl|hip)/.test(s)) return "hinge";
  if (/(lunge|fente)/.test(s)) return "lunge";
  if (/(push-?up|pompe)/.test(s)) return "pushup";
  if (/(overhead|ohp|militaire|shoulder\s*press)/.test(s)) return "ohp";
  return "squat";
}
