// apps/web/components/GrayCoach3DGLTF.tsx
"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

type Fault = { issue: string; severity: "faible" | "moyenne" | "élevée"; correction?: string };
type AIAnalysis = {
  exercise: string;
  movement_pattern?: string;
  faults?: Fault[];
};

type Props = {
  analysis: AIAnalysis;
  /** Permet d’imposer l’exercice confirmé par l’utilisateur côté page */
  exerciseOverride?: string;
  /** Hauteur en px de la zone 3D (largeur = 100%) */
  height?: number;
};

/**
 * Mannequin 3D "démo"
 * - Pas de R3F/Drei → pur Three.js pour éviter les problèmes de typings sur Netlify
 * - Taille minimale forcée pour éviter un canvas 0x0 (écran noir)
 * - Boucle d’animation requestAnimationFrame + resize observer
 */
export default function GrayCoach3DGLTF({
  analysis,
  exerciseOverride,
  height = 420,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ⚠️ Taille sûre (fallback si clientWidth/Height === 0)
    const initialW = container.clientWidth || 640;
    const initialH = container.clientHeight || height || 420;

    // Rendu
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initialW, initialH, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x0b0b0b, 1);

    // Caméra
    const camera = new THREE.PerspectiveCamera(45, initialW / initialH, 0.1, 100);
    camera.position.set(0, 1.4, 3);

    // Scène
    const scene = new THREE.Scene();

    // Lumières
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 8, 5);
    dir.castShadow = false;
    scene.add(dir);

    // Sol
    const floorGeo = new THREE.PlaneGeometry(6, 6);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.1,
      roughness: 0.9,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    // Mannequin simple (capsules+sphères)
    const mannequin = buildMannequin();
    mannequin.position.y = 0.05;
    scene.add(mannequin);

    // Ajout au DOM
    container.appendChild(renderer.domElement);

    // Resize (observe le conteneur)
    const resize = () => {
      const w = container.clientWidth || initialW;
      const h = container.clientHeight || initialH;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Animation en fonction de l’exercice confirmé / détecté
    const exercise = (exerciseOverride || analysis?.exercise || analysis?.movement_pattern || "squat").toLowerCase();

    let raf = 0;
    const clock = new THREE.Clock();

    const loop = () => {
      const t = clock.getElapsedTime();
      animateMannequin(mannequin, exercise, t);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    // Cleanup
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeChild(renderer.domElement);
      // Libère géométries / matériaux
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose?.();
        if ((m.material as any)?.dispose) (m.material as any).dispose();
      });
      renderer.dispose();
    };
    // on relance si l’exercice confirmé change
  }, [analysis?.exercise, analysis?.movement_pattern, exerciseOverride, height]);

  return (
    <div className="w-full">
      <div className="text-sm text-muted-foreground mb-2">
        Démo 3D — <span className="font-medium">{labelize(exerciseOverride || analysis?.exercise || analysis?.movement_pattern || "Exercice")}</span>
      </div>
      <div
        ref={mountRef}
        // ⚠️ on force une hauteur non nulle pour éviter le 0x0
        style={{ width: "100%", height, minHeight: height, background: "#0b0b0b", borderRadius: 12, overflow: "hidden" }}
        className="border"
      />
      <p className="text-xs text-muted-foreground mt-2">
        Le mannequin rejoue l’exercice confirmé, en version corrigée, <b>sans afficher ta vidéo</b>.
      </p>
    </div>
  );
}

/* ======================= Mannequin ======================= */

function buildMannequin(): THREE.Group {
  const grp = new THREE.Group();

  const gray = new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.6, metalness: 0.05 });

  // utilitaires géométrie
  const sphere = (r: number) => new THREE.SphereGeometry(r, 24, 24);
  const capsule = (r: number, h: number) => new THREE.CapsuleGeometry(r, h, 8, 16);

  // Segments
  const head = new THREE.Mesh(sphere(0.12), gray);

  const chest = new THREE.Mesh(capsule(0.16, 0.14), gray);
  chest.rotation.z = Math.PI / 2;

  const pelvis = new THREE.Mesh(capsule(0.18, 0.1), gray);
  pelvis.rotation.z = Math.PI / 2;

  const upperArmL = new THREE.Mesh(capsule(0.07, 0.18), gray);
  const upperArmR = new THREE.Mesh(capsule(0.07, 0.18), gray);
  const forearmL = new THREE.Mesh(capsule(0.06, 0.18), gray);
  const forearmR = new THREE.Mesh(capsule(0.06, 0.18), gray);

  const thighL = new THREE.Mesh(capsule(0.09, 0.22), gray);
  const thighR = new THREE.Mesh(capsule(0.09, 0.22), gray);
  const shinL = new THREE.Mesh(capsule(0.08, 0.22), gray);
  const shinR = new THREE.Mesh(capsule(0.08, 0.22), gray);

  // Groupes articulations (pivot)
  const root = new THREE.Group();
  const spine = new THREE.Group();
  const neck = new THREE.Group();
  const shoulderL = new THREE.Group();
  const shoulderR = new THREE.Group();
  const elbowL = new THREE.Group();
  const elbowR = new THREE.Group();
  const hipL = new THREE.Group();
  const hipR = new THREE.Group();
  const kneeL = new THREE.Group();
  const kneeR = new THREE.Group();

  // Hiérarchie
  root.add(pelvis);
  root.add(spine);
  spine.position.y = 0.28;
  spine.add(chest);
  chest.position.y = 0.0;

  spine.add(neck);
  neck.position.y = 0.24;
  neck.add(head);
  head.position.y = 0.14;

  spine.add(shoulderL);
  spine.add(shoulderR);
  shoulderL.position.set(-0.22, 0.18, 0);
  shoulderR.position.set(0.22, 0.18, 0);

  shoulderL.add(upperArmL);
  shoulderR.add(upperArmR);
  upperArmL.rotation.z = Math.PI / 2;
  upperArmR.rotation.z = Math.PI / 2;
  upperArmL.position.x = -0.14;
  upperArmR.position.x = 0.14;

  shoulderL.add(elbowL);
  shoulderR.add(elbowR);
  elbowL.position.x = -0.28;
  elbowR.position.x = 0.28;

  elbowL.add(forearmL);
  elbowR.add(forearmR);
  forearmL.rotation.z = Math.PI / 2;
  forearmR.rotation.z = Math.PI / 2;
  forearmL.position.x = -0.14;
  forearmR.position.x = 0.14;

  root.add(hipL);
  root.add(hipR);
  hipL.position.set(-0.13, 0.08, 0);
  hipR.position.set(0.13, 0.08, 0);

  hipL.add(thighL);
  hipR.add(thighR);
  thighL.rotation.z = Math.PI / 2;
  thighR.rotation.z = Math.PI / 2;
  thighL.position.x = -0.16;
  thighR.position.x = 0.16;

  hipL.add(kneeL);
  hipR.add(kneeR);
  kneeL.position.x = -0.32;
  kneeR.position.x = 0.32;

  kneeL.add(shinL);
  kneeR.add(shinR);
  shinL.rotation.z = Math.PI / 2;
  shinR.rotation.z = Math.PI / 2;
  shinL.position.x = -0.14;
  shinR.position.x = 0.14;

  grp.add(root);
  grp.userData = {
    nodes: {
      root,
      spine,
      neck,
      shoulderL,
      shoulderR,
      elbowL,
      elbowR,
      hipL,
      hipR,
      kneeL,
      kneeR,
      // segments utiles si besoin plus tard
      head,
      chest,
      pelvis,
      upperArmL,
      upperArmR,
      forearmL,
      forearmR,
      thighL,
      thighR,
      shinL,
      shinR,
    },
  };

  return grp;
}

/* ======================= Animation ======================= */

function animateMannequin(group: THREE.Group, exercise: string, t: number) {
  const n = (group.userData?.nodes || {}) as any;

  // Rythmes communs
  const s = Math.sin;
  const c = Math.cos;

  // Réduire amplitude si nécessaire
  const clamp = (v: number, a = -1, b = 1) => Math.min(b, Math.max(a, v));

  // RESET léger (revient vers 0 pour éviter la dérive)
  [n.spine, n.neck, n.shoulderL, n.shoulderR, n.elbowL, n.elbowR, n.hipL, n.hipR, n.kneeL, n.kneeR].forEach((g: THREE.Group) => {
    if (!g) return;
    g.rotation.x *= 0.9;
    g.rotation.y *= 0.9;
    g.rotation.z *= 0.9;
  });

  if (/pull|traction|chin|barre\s*fixe/.test(exercise)) {
    // Tractions : coudes qui tirent vers le bas, épaules en abaissement, genoux légèrement fléchis
    const r = (s(t * 2) * 0.6 + 0.6) * 0.9; // 0→~1.1
    if (n.shoulderL && n.shoulderR) {
      n.shoulderL.rotation.z = clamp(-r * 0.6, -1.2, 0);
      n.shoulderR.rotation.z = clamp(r * 0.6, 0, 1.2);
    }
    if (n.elbowL && n.elbowR) {
      n.elbowL.rotation.z = clamp(-r * 1.2, -1.8, 0);
      n.elbowR.rotation.z = clamp(r * 1.2, 0, 1.8);
    }
    if (n.kneeL && n.kneeR) {
      const k = (s(t * 2) * 0.3 + 0.3) * 0.4;
      n.kneeL.rotation.z = -k;
      n.kneeR.rotation.z = k;
    }
  } else if (/squat|goblet|front/.test(exercise)) {
    // Squat : flexion/extension genoux/hanches
    const d = (s(t * 2) * 0.5 + 0.5); // 0→1
    const hip = -d * 1.0;
    const knee = -d * 1.4;
    if (n.hipL && n.hipR) {
      n.hipL.rotation.z = hip;
      n.hipR.rotation.z = -hip;
    }
    if (n.kneeL && n.kneeR) {
      n.kneeL.rotation.z = knee;
      n.kneeR.rotation.z = -knee;
    }
    if (n.spine) n.spine.rotation.x = d * 0.15; // buste légèrement penché
  } else if (/deadlift|soulev|hinge|rdl|romanian/.test(exercise)) {
    // Hinge : charnière de hanches + genoux peu fléchis
    const d = (s(t * 2) * 0.5 + 0.5);
    if (n.spine) n.spine.rotation.x = d * 0.5;
    if (n.hipL && n.hipR) {
      n.hipL.rotation.z = -d * 0.8;
      n.hipR.rotation.z = d * 0.8;
    }
    if (n.kneeL && n.kneeR) {
      n.kneeL.rotation.z = -d * 0.3;
      n.kneeR.rotation.z = d * 0.3;
    }
  } else if (/push-?up|pompes?/.test(exercise)) {
    // Pompes : coudes fléchissent/extend, buste qui descend
    const d = (s(t * 2.2) * 0.5 + 0.5);
    if (n.elbowL && n.elbowR) {
      n.elbowL.rotation.z = -d * 1.2;
      n.elbowR.rotation.z = d * 1.2;
    }
    if (n.spine) n.spine.rotation.x = d * 0.2;
  } else if (/lunge|fente/.test(exercise)) {
    // Fentes : alternance jambe avant/arrière
    const d = s(t * 2);
    if (n.hipL && n.hipR) {
      n.hipL.rotation.z = -Math.max(0, d) * 1.0;
      n.hipR.rotation.z = Math.max(0, -d) * 1.0;
    }
    if (n.kneeL && n.kneeR) {
      n.kneeL.rotation.z = -Math.max(0, d) * 1.5;
      n.kneeR.rotation.z = Math.max(0, -d) * 1.5;
    }
    if (n.spine) n.spine.rotation.y = d * 0.1;
  } else if (/ohp|overhead|shoulder|développé/.test(exercise)) {
    // Développé militaire : épaules + coudes poussent vers le haut
    const d = (s(t * 2) * 0.5 + 0.5);
    if (n.shoulderL && n.shoulderR) {
      n.shoulderL.rotation.z = -d * 0.6;
      n.shoulderR.rotation.z = d * 0.6;
    }
    if (n.elbowL && n.elbowR) {
      n.elbowL.rotation.z = -d * 0.8;
      n.elbowR.rotation.z = d * 0.8;
    }
    if (n.spine) n.spine.rotation.x = -d * 0.05;
  } else {
    // Par défaut : petit squat doux (toujours mieux que rien)
    const d = (s(t * 2) * 0.5 + 0.5);
    if (n.hipL && n.hipR) {
      n.hipL.rotation.z = -d * 0.8;
      n.hipR.rotation.z = d * 0.8;
    }
    if (n.kneeL && n.kneeR) {
      n.kneeL.rotation.z = -d * 1.2;
      n.kneeR.rotation.z = d * 1.2;
    }
  }
}

/* ======================= Helpers ======================= */

function labelize(s: string) {
  const x = s.trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
}
