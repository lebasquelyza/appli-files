"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Props = {
  analysis: any;
  /** Exercice confirmé par l’utilisateur (prioritaire sur analysis.exercise) */
  exerciseOverride?: string;
};

/**
 * Mannequin 3D articulé “gris” (démo) – Three.js pur (pas de R3F).
 * - Proportions athlétiques simples
 * - Segments : tête, cou, thorax, bassin, bras (bras/avant-bras), jambes (cuisse/tibia), pieds
 * - Animations par angles suivant l’exercice confirmé
 */
export default function GrayCoach3DGLTF({ analysis, exerciseOverride }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    // ---------- Rendu / Scène / Caméra ----------
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0b);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    camera.position.set(2.8, 1.8, 3.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // ---------- Lumières ----------
    const amb = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 1);
    key.position.set(4, 6, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(-3, 5, -4);
    scene.add(rim);

    // ---------- Sol ----------
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.1;
    scene.add(ground);

    // Grille très légère
    const grid = new THREE.GridHelper(50, 50, 0x2a2a2a, 0x1c1c1c);
    (grid.material as THREE.LineBasicMaterial).opacity = 0.25;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    grid.position.y = -1.099;
    scene.add(grid);

    // ---------- Matériaux ----------
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb5b5b5, roughness: 0.8, metalness: 0.1 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.7, metalness: 0.2 });
    const footMat = new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.9, metalness: 0.05 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.4, metalness: 0.7 });

    // ---------- Helpers géométries ----------
    const Capsule = (r = 0.2, h = 1, sr = 8, sh = 12) =>
      // capsule si dispo, sinon cylindre “softened”
      (THREE as any).CapsuleGeometry
        ? new (THREE as any).CapsuleGeometry(r, Math.max(h - 2 * r, 0.0001), sr, sh)
        : new THREE.CylinderGeometry(r, r, h, Math.max(12, sh));

    // ---------- Hiérarchie du mannequin ----------
    const mannequin = new THREE.Group();
    scene.add(mannequin);

    // Proportions (mètres approx)
    const heightTotal = 1.80;
    const pelvisY = -0.15;
    const spineLen = 0.50;
    const chestLen = 0.25;
    const neckLen = 0.10;
    const headR = 0.11;

    const upperArmLen = 0.30;
    const foreArmLen = 0.28;
    const thighLen = 0.42;
    const shinLen = 0.42;
    const footLen = 0.22;

    // Pivots centraux
    const pelvis = new THREE.Object3D();
    pelvis.position.set(0, pelvisY, 0);
    mannequin.add(pelvis);

    const spine = new THREE.Object3D();
    spine.position.set(0, 0.0, 0);
    pelvis.add(spine);

    const chest = new THREE.Object3D();
    chest.position.set(0, spineLen, 0);
    spine.add(chest);

    const neck = new THREE.Object3D();
    neck.position.set(0, chestLen, 0);
    chest.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 24, 20), bodyMat);
    head.position.set(0, neckLen + headR, 0);
    neck.add(head);

    // Tronc (capsules)
    const spineMesh = new THREE.Mesh(Capsule(0.18, spineLen), bodyMat);
    spineMesh.position.set(0, spineLen / 2, 0);
    spine.add(spineMesh);

    const chestMesh = new THREE.Mesh(Capsule(0.21, chestLen), bodyMat);
    chestMesh.position.set(0, chestLen / 2, 0);
    chest.add(chestMesh);

    // Épaules (points d’attache)
    const shoulderY = chestLen * 0.8;
    const shoulderW = 0.40;

    const shoulderL = new THREE.Object3D();
    shoulderL.position.set(-shoulderW / 2, shoulderY, 0);
    chest.add(shoulderL);

    const shoulderR = new THREE.Object3D();
    shoulderR.position.set(shoulderW / 2, shoulderY, 0);
    chest.add(shoulderR);

    // Bras (2 segments + “boules” d’articulation)
    function buildArm(side: "L" | "R") {
      const s = side === "L" ? -1 : 1;
      const upper = new THREE.Object3D();
      upper.position.set(0, 0, 0);
      const upperMesh = new THREE.Mesh(Capsule(0.09, upperArmLen), jointMat);
      upperMesh.position.y = -upperArmLen / 2;
      upper.add(upperMesh);

      const elbow = new THREE.Object3D();
      elbow.position.set(0, -upperArmLen, 0);
      upper.add(elbow);

      const fore = new THREE.Object3D();
      fore.position.set(0, 0, 0);
      const foreMesh = new THREE.Mesh(Capsule(0.085, foreArmLen), jointMat);
      foreMesh.position.y = -foreArmLen / 2;
      fore.add(foreMesh);

      const wrist = new THREE.Object3D();
      wrist.position.set(0, -foreArmLen, 0);
      fore.add(wrist);

      // petite sphère pour l’épaule
      const ballShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), jointMat);
      upper.add(ballShoulder);

      // assemblage
      (side === "L" ? shoulderL : shoulderR).add(upper);
      elbow.add(fore);

      return { upper, elbow, fore, wrist, upperMesh, foreMesh, sideSign: s };
    }

    const armL = buildArm("L");
    const armR = buildArm("R");

    // Bassin visuel
    const pelvisMesh = new THREE.Mesh(Capsule(0.22, 0.20), bodyMat);
    pelvisMesh.position.set(0, 0.10, 0);
    pelvis.add(pelvisMesh);

    // Hanches
    const hipW = 0.26;

    const hipL = new THREE.Object3D();
    hipL.position.set(-hipW / 2, 0.06, 0);
    pelvis.add(hipL);

    const hipR = new THREE.Object3D();
    hipR.position.set(hipW / 2, 0.06, 0);
    pelvis.add(hipR);

    // Jambes (2 segments + pieds)
    function buildLeg(side: "L" | "R") {
      const s = side === "L" ? -1 : 1;
      const thigh = new THREE.Object3D();
      const thighMesh = new THREE.Mesh(Capsule(0.11, thighLen), jointMat);
      thighMesh.position.y = -thighLen / 2;
      thigh.add(thighMesh);

      const knee = new THREE.Object3D();
      knee.position.set(0, -thighLen, 0);
      thigh.add(knee);

      const shin = new THREE.Object3D();
      const shinMesh = new THREE.Mesh(Capsule(0.10, shinLen), jointMat);
      shinMesh.position.y = -shinLen / 2;
      shin.add(shinMesh);

      const ankle = new THREE.Object3D();
      ankle.position.set(0, -shinLen, 0);
      shin.add(ankle);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(footLen, 0.06, 0.10), footMat);
      foot.position.set(footLen / 2 - 0.02, -0.03, 0);
      ankle.add(foot);

      (side === "L" ? hipL : hipR).add(thigh);
      knee.add(shin);

      return { thigh, knee, shin, ankle, foot, sideSign: s };
    }

    const legL = buildLeg("L");
    const legR = buildLeg("R");

    // ---------- Barre de traction (affichée seulement si traction) ----------
    const pullupBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 16), barMat);
    pullupBar.rotation.z = Math.PI / 2;
    pullupBar.position.set(0, 2.35, 0);
    pullupBar.visible = false;
    scene.add(pullupBar);

    // ---------- Contrôles caméra ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.6, 0);
    controls.update();

    // ---------- Petite API de pose (angles) ----------
    type Deg = number;
    const toRad = (d: Deg) => (d * Math.PI) / 180;

    function setArmPose(
      arm: ReturnType<typeof buildArm>,
      shFlex: Deg, // + vers l’avant
      shAbd: Deg,  // + vers l’extérieur
      shRot: Deg,  // rotation interne/extern
      elbowFlex: Deg
    ) {
      arm.upper.rotation.set(toRad(-shFlex), toRad(shRot * arm.sideSign), toRad(shAbd * arm.sideSign));
      arm.fore.rotation.set(toRad(-elbowFlex), 0, 0);
    }

    function setLegPose(
      leg: ReturnType<typeof buildLeg>,
      hipFlex: Deg,   // + flexion hanche
      hipAbd: Deg,    // + abduction
      kneeFlex: Deg,  // + flexion genou
      ankleFlex: Deg  // + dorsiflexion (positive = tibia avançant)
    ) {
      leg.thigh.rotation.set(toRad(-hipFlex), 0, toRad(hipAbd * leg.sideSign));
      leg.shin.rotation.set(toRad(kneeFlex), 0, 0);
      leg.ankle.rotation.set(toRad(-ankleFlex), 0, 0);
    }

    function neutralPose() {
      pelvis.rotation.set(0, 0, 0);
      spine.rotation.set(0, 0, 0);
      chest.rotation.set(0, 0, 0);
      neck.rotation.set(0, 0, 0);

      setArmPose(armL, 10, 5, 0, 10);
      setArmPose(armR, 10, -5, 0, 10);

      setLegPose(legL, 0, 2, 0, 0);
      setLegPose(legR, 0, -2, 0, 0);

      mannequin.position.set(0, 0, 0);
      mannequin.rotation.set(0, 0.15, 0); // léger 3/4
    }

    neutralPose();

    // ---------- Choix d’exercice ----------
    const exerciseRaw = (exerciseOverride || analysis?.exercise || "").toLowerCase();
    const isPullup = /(traction|pull[\s-]?up|chin[\s-]?up)/.test(exerciseRaw);
    const isSquat = /(squat|goblet)/.test(exerciseRaw);
    const isHinge = /(soulev|deadlift|hinge|rdl|romanian)/.test(exerciseRaw);
    const isLunge = /(fente|lunge)/.test(exerciseRaw);
    const isPushup = /(pompe|push[\s-]?up)/.test(exerciseRaw);
    const isOHP = /(overhead|shoulder|développé)/.test(exerciseRaw);

    pullupBar.visible = isPullup;

    // ---------- Animations (onde sinusoïdale simple, loop) ----------
    const t0 = performance.now();
    let raf = 0;

    const animate = () => {
      const t = (performance.now() - t0) / 1000; // s
      const s = 0.5 + 0.5 * Math.sin(t * 2.0);   // 0..1
      const sFast = 0.5 + 0.5 * Math.sin(t * 2.6);

      // Reset neutre à chaque frame avant d’appliquer l’animation
      neutralPose();

      if (isPullup) {
        // Tractions : corps “pendu”, coude se ferme, translation verticale + mains sur barre
        const pull = s; // 0 bas, 1 haut
        mannequin.position.y = THREE.MathUtils.lerp(-0.35, 0.15, pull);

        // Épaules légèrement en abduction et flexion
        setArmPose(armL, 25, 25, 0, THREE.MathUtils.lerp(10, 120, pull));
        setArmPose(armR, 25, -25, 0, THREE.MathUtils.lerp(10, 120, pull));

        // Jambes tendues, chevilles neutres
        setLegPose(legL, 5, 2, 5, 0);
        setLegPose(legR, 5, -2, 5, 0);
      } else if (isSquat) {
        // Squat : flexion genou/hanche synchronisée
        const depth = s; // 0 en haut, 1 en bas
        const knee = THREE.MathUtils.lerp(5, 95, depth);
        const hip = THREE.MathUtils.lerp(0, 35, depth);
        const ankle = THREE.MathUtils.lerp(0, 10, depth);

        setLegPose(legL, hip, 2, knee, ankle);
        setLegPose(legR, hip, -2, knee, ankle);

        // buste s’incline légèrement
        spine.rotation.x = -toRad(5 + 8 * depth);
        chest.rotation.x = -toRad(4 + 6 * depth);

        // bras en contrepoids
        setArmPose(armL, THREE.MathUtils.lerp(10, 40, depth), 5, 0, 15);
        setArmPose(armR, THREE.MathUtils.lerp(10, 40, depth), -5, 0, 15);
      } else if (isHinge) {
        // Soulevé/hinge : forte flexion hanche, genou peu fléchi
        const hinge = s;
        const hip = THREE.MathUtils.lerp(5, 55, hinge);
        const knee = THREE.MathUtils.lerp(5, 20, hinge);
        const ankle = THREE.MathUtils.lerp(0, 8, hinge);

        setLegPose(legL, hip, 1, knee, ankle);
        setLegPose(legR, hip, -1, knee, ankle);

        spine.rotation.x = -toRad(5 + 22 * hinge);
        chest.rotation.x = -toRad(5 + 16 * hinge);
        setArmPose(armL, 10, 4, 0, 10);
        setArmPose(armR, 10, -4, 0, 10);
      } else if (isLunge) {
        // Fente : on alterne gauche/droite doucement
        const alt = 0.5 + 0.5 * Math.sin(t * 1.2); // 0..1
        const kneeF = THREE.MathUtils.lerp(10, 90, alt);
        const hipF = THREE.MathUtils.lerp(0, 30, alt);
        const ankleF = THREE.MathUtils.lerp(0, 10, alt);

        setLegPose(legL, hipF, 1, kneeF, ankleF);
        setLegPose(legR, 10, -1, 15, 0);

        spine.rotation.y = toRad(6 * Math.sin(t * 0.8));
        setArmPose(armL, 20, 6, 0, 15);
        setArmPose(armR, 5, -6, 0, 10);
      } else if (isPushup) {
        // Pompes : variation bras + buste qui s’incline
        const press = sFast;
        const elbow = THREE.MathUtils.lerp(10, 110, press);
        setArmPose(armL, 25, 15, 0, elbow);
        setArmPose(armR, 25, -15, 0, elbow);

        spine.rotation.x = -toRad(10 + 20 * press);
        chest.rotation.x = -toRad(6 + 16 * press);

        setLegPose(legL, 5, 1, 10, 5);
        setLegPose(legR, 5, -1, 10, 5);
      } else if (isOHP) {
        // Développé militaire : bras qui montent/descendent au-dessus de la tête
        const raise = s;
        const shoulderFlex = THREE.MathUtils.lerp(30, 160, raise);
        const elbowFlex = THREE.MathUtils.lerp(20, 5, raise);

        setArmPose(armL, shoulderFlex, 15, 0, elbowFlex);
        setArmPose(armR, shoulderFlex, -15, 0, elbowFlex);

        spine.rotation.x = -toRad(4 * raise);
        setLegPose(legL, 5, 2, 5, 0);
        setLegPose(legR, 5, -2, 5, 0);
      } else {
        // Idling doux
        mannequin.rotation.y = 0.15 * Math.sin(t * 0.7);
      }

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    // ---------- Resize ----------
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 420;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // GO
    animate();

    // ---------- Cleanup ----------
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();

      groundGeo.dispose();
      (groundMat as any).dispose?.();
      (grid.geometry as any).dispose?.();
      (grid.material as any).dispose?.();

      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [analysis, exerciseOverride]);

  const exercise = (exerciseOverride || analysis?.exercise || "exercice").trim();

  return (
    <div>
      <div ref={mountRef} className="w-full h-[420px] rounded-xl border overflow-hidden" />
      <p className="text-center text-xs text-muted-foreground mt-2">
        Démo 3D — <b>{exercise || "exercice"}</b>
      </p>
    </div>
  );
}
