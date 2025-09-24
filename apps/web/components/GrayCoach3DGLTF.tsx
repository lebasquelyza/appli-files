// apps/web/components/GrayCoach3DGLTF.tsx
"use client";

/**
 * Mannequin 3D "démo" sans R3F : pur Three.js sur <canvas>.
 * - Pas de dépendances @react-three/fiber / drei.
 * - Sûr pour Netlify/SSR : tout est côté client.
 * - Animation simple selon l'exercice (squat, hinge, lunge, pushup, ohp, pullup).
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

    let t0 = performance.now();

    (async () => {
      if (!mounted) return;

      // Charger Three côté client
      if (!THREE) THREE = await import("three");
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
      // cadrage plus naturel et un chouïa en plongée
      camera.position.set(0.8, 1.8, 4.6);
      camera.lookAt(0, 1.4, 0);
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
      rig.position.y = 0;
      scene.add(rig);

      // Matériaux gris
      const gray = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, metalness: 0.1, roughness: 0.6 });
      const darkGray = new THREE.MeshStandardMaterial({ color: 0x8f8f8f, metalness: 0.2, roughness: 0.5 });

      // util
      const makeBone = (geo: import("three").BufferGeometry, mat = gray) => new THREE!.Mesh(geo, mat);

      // Torse + tête
      torso = makeBone(new THREE!.BoxGeometry(0.5, 0.7, 0.25), gray);
      torso.position.set(0, 1.3, 0);
      rig.add(torso);

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

      // Barre (traction / OHP / deadlift)
      bar = new THREE!.Mesh(
        new THREE!.CylinderGeometry(0.03, 0.03, 1.25, 20),
        new THREE!.MeshStandardMaterial({ color: 0xcccccc })
      );
      bar.rotation.z = Math.PI / 2;
      bar.visible = false;
      scene.add(bar);

      // Resize
      const onResize = () => {
        if (!renderer || !camera || !container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        // recadrage mobile: si très étroit, recule un peu
        if (w < 420) {
          camera.position.set(0.9, 1.9, 5.2);
        } else {
          camera.position.set(0.8, 1.8, 4.6);
        }
      };
      onResize();
      window.addEventListener("resize", onResize);

      // ====== Fonctions d'animation — DÉFINIES AVANT UTILISATION ======
      function resetPose() {
        rig.position.y = 0;
        torso.rotation.set(0, 0, 0);
        head.position.set(0, 1.75, 0);

        upperArmL.rotation.set(0, 0, Math.PI / 2.4);
        lowerArmL.rotation.set(0, 0, Math.PI / 2.8);
        handL.rotation.set(0, 0, 0);

        upperArmR.rotation.set(0, 0, -Math.PI / 2.4);
        lowerArmR.rotation.set(0, 0, -Math.PI / 2.8);
        handR.rotation.set(0, 0, 0);

        upperLegL.rotation.set(0, 0, 0);
        lowerLegL.rotation.set(0, 0, 0);
        footL.rotation.set(0, 0, 0);

        upperLegR.rotation.set(0, 0, 0);
        lowerLegR.rotation.set(0, 0, 0);
        footR.rotation.set(0, 0, 0);
      }

      function squat(t: number) {
        const d = mix(0, 0.55, t < 0.5 ? t * 2 : (1 - t) * 2);
        rig.position.y = -d * 0.5;
        upperLegL.rotation.x = d * 1.0;
        lowerLegL.rotation.x = d * 0.6;
        upperLegR.rotation.x = d * 1.0;
        lowerLegR.rotation.x = d * 0.6;
        torso.rotation.x = d * 0.25;
      }

      function deadliftHinge(t: number) {
        const bend = mix(0.0, 0.9, t < 0.5 ? t * 2 : (1 - t) * 2);
        torso.rotation.x = bend * 0.6;
        upperLegL.rotation.x = bend * 0.2;
        lowerLegL.rotation.x = bend * 0.15;
        upperLegR.rotation.x = bend * 0.2;
        lowerLegR.rotation.x = bend * 0.15;
        bar.visible = true;
        bar.position.set(0, 1.0 - bend * 0.4, 0.15);
      }

      function lunge(t: number) {
        const step = Math.sin(t * Math.PI * 2);
        upperLegL.rotation.x = Math.max(0, step) * 0.9;
        lowerLegL.rotation.x = Math.max(0, step) * 0.6;
        upperLegR.rotation.x = Math.max(0, -step) * 0.9;
        lowerLegR.rotation.x = Math.max(0, -step) * 0.6;
        rig.position.y = -Math.abs(step) * 0.25;
      }

      function pushup(t: number) {
        const d = mix(0.0, 0.45, t < 0.5 ? t * 2 : (1 - t) * 2);
        rig.position.y = -d * 0.35;
        torso.rotation.x = d * 0.15;
        upperArmL.rotation.z = Math.PI / 2.4 + d * 0.3;
        lowerArmL.rotation.z = Math.PI / 2.8 + d * 0.4;
        upperArmR.rotation.z = -Math.PI / 2.4 - d * 0.3;
        lowerArmR.rotation.z = -Math.PI / 2.8 - d * 0.4;
      }

      function overheadPress(t: number) {
        const lift = mix(0.0, 1.0, t < 0.5 ? t * 2 : (1 - t) * 2);
        upperArmL.rotation.z = Math.PI / 2.4 - lift * 1.0;
        lowerArmL.rotation.z = Math.PI / 2.8 - lift * 0.8;
        upperArmR.rotation.z = -Math.PI / 2.4 + lift * 1.0;
        lowerArmR.rotation.z = -Math.PI / 2.8 + lift * 0.8;
        bar.visible = true;
        bar.position.set(0, 1.1 + lift * 0.6, 0.25);
      }

      function pullUp(t: number) {
        // t: 0 -> bas (bras presque tendus) ; 1 -> menton au-dessus de la barre
        const up = mix(0.0, 1.0, t < 0.5 ? t * 2 : (1 - t) * 2);

        // barre visible, au-dessus de la tête
        bar.visible = true;
        bar.position.set(0, 2.35, 0.0);

        // légère extension thoracique (dépression scapulaire)
        torso.rotation.x = -0.06;

        // bras au-dessus de la tête : de 1.35rad (début) à 0.65rad (haut)
        const startUpper = 1.35;
        const endUpper = 0.65;
        upperArmL.rotation.z = mix(startUpper, endUpper, up);
        upperArmR.rotation.z = -mix(startUpper, endUpper, up);

        // coudes de ~1.05rad vers ~0 (très fléchi)
        const startLower = 1.05;
        const endLower = 0.0;
        lowerArmL.rotation.z = mix(startLower, endLower, up);
        lowerArmR.rotation.z = -mix(startLower, endLower, up);

        // corps qui monte
        const rise = up * 0.95;
        rig.position.y = rise * 0.85;

        // hollow body léger
        const hollow = 0.12 * up;
        upperLegL.rotation.x = hollow * 0.8;
        upperLegR.rotation.x = hollow * 0.8;

        // tout en haut : petite adduction scapulaire
        if (up > 0.85) {
          torso.rotation.x = -0.02;
          upperArmL.rotation.z -= 0.06;
          upperArmR.rotation.z += 0.06;
        }
      }

      // ====== Animation loop ======
      const exo = normalizeExercise(exerciseOverride || analysis.exercise || analysis.movement_pattern || "");
      const animate = (now: number) => {
        const dt = (now - t0) / 1000;
        t0 = now;

        const cycle = 2.2;
        const phase = (now / 1000) % cycle;
        const t = easeInOut((phase / cycle) % 1);

        resetPose();

        // pose “ready” pour pull-up: bras au-dessus, prise largeur épaules
        if (exo === "pullup") {
          bar.visible = true;
          bar.position.set(0, 2.35, 0.0);
          upperArmL.rotation.z = 1.35;
          lowerArmL.rotation.z = 1.05;
          upperArmR.rotation.z = -1.35;
          lowerArmR.rotation.z = -1.05;
          torso.rotation.x = -0.06;
        }

        switch (exo) {
          case "pullup":
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

      // Cleanup
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
        renderer = null;
        scene = null;
        camera = null;
      };

      if (!mounted) cleanup();
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
