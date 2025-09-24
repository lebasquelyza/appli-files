"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Props = {
  analysis: any;
  /** Nom confirmé par l’utilisateur (prioritaire) */
  exerciseOverride?: string;
};

/**
 * GrayCoach3DGLTF (démo améliorée)
 * - Silhouette “humaine” athlétique (épaules/pecs/lats/bassin + segments)
 * - Mains et pieds simples
 * - Animations dédiées (pull-up, squat, hinge, fente, pompes, OHP) plus réalistes
 * - Three.js pur (pas de @react-three/*) -> OK en build Netlify
 */
export default function GrayCoach3DGLTF({ analysis, exerciseOverride }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    // ---------- Renderer / Scene / Camera ----------
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 420;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0b);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(2.9, 1.9, 3.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // ---------- Lights ----------
    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 6, 3);
    key.castShadow = false;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.55);
    rim.position.set(-4, 5, -3);
    scene.add(rim);

    // ---------- Ground ----------
    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.12;
    scene.add(ground);

    const grid = new THREE.GridHelper(40, 40, 0x2b2b2b, 0x1a1a1a);
    (grid.material as THREE.LineBasicMaterial).opacity = 0.25;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    grid.position.y = -1.119;
    scene.add(grid);

    // ---------- Materials ----------
    const skin = new THREE.Color(0xb9b9b9);
    const darker = new THREE.Color(0x969696);
    const bodyMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7, metalness: 0.15 });
    const jointMat = new THREE.MeshStandardMaterial({ color: darker, roughness: 0.7, metalness: 0.25 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0x6d6d6d, roughness: 0.4, metalness: 0.7 });

    // ---------- Geometry helpers ----------
    const Capsule = (r = 0.2, h = 1, sr = 12, sh = 18) =>
      (THREE as any).CapsuleGeometry
        ? new (THREE as any).CapsuleGeometry(r, Math.max(h - 2 * r, 0.0001), sr, sh)
        : new THREE.CylinderGeometry(r, r, h, Math.max(16, sh));

    // ---------- Rig (proportions athlétiques ~1m80) ----------
    const mannequin = new THREE.Group();
    scene.add(mannequin);

    const headR = 0.11;
    const neckLen = 0.11;
    const chestLen = 0.28;
    const spineLen = 0.50;
    const pelvisDrop = -0.12;

    const upperArm = 0.32;
    const foreArm = 0.29;
    const thighLen = 0.44;
    const shinLen = 0.43;
    const footL = 0.24;
    const footH = 0.07;

    // Pelvis (visuel “bassin” plus large)
    const pelvis = new THREE.Object3D();
    pelvis.position.set(0, pelvisDrop, 0);
    mannequin.add(pelvis);

    const pelvisMesh = new THREE.Mesh(Capsule(0.23, 0.22), bodyMat);
    pelvisMesh.scale.set(1.15, 1, 1); // un peu plus de largeur bassin
    pelvisMesh.position.y = 0.12;
    pelvis.add(pelvisMesh);

    // Spine + chest (pecs + lats subtils)
    const spine = new THREE.Object3D();
    spine.position.set(0, 0.02, 0);
    pelvis.add(spine);

    const spineMesh = new THREE.Mesh(Capsule(0.18, spineLen), bodyMat);
    spineMesh.position.y = spineLen / 2;
    spine.add(spineMesh);

    const chest = new THREE.Object3D();
    chest.position.set(0, spineLen, 0);
    spine.add(chest);

    // Thorax plus “athlétique”
    const ribcage = new THREE.Mesh(Capsule(0.22, chestLen), bodyMat);
    ribcage.position.y = chestLen / 2;
    ribcage.scale.set(1.12, 1, 1.06); // épaules/pecs un peu plus larges
    chest.add(ribcage);

    // Pectoraux (léger volume)
    const pecs = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), bodyMat);
    pecs.scale.set(1.25, 0.6, 0.9);
    pecs.position.set(0, chestLen * 0.65, 0.09);
    chest.add(pecs);

    // Lats (dos en V léger)
    const lats = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), bodyMat);
    lats.scale.set(1.35, 0.6, 0.8);
    lats.position.set(0, chestLen * 0.35, -0.05);
    chest.add(lats);

    // Neck + head
    const neck = new THREE.Object3D();
    neck.position.set(0, chestLen, 0);
    chest.add(neck);

    const neckMesh = new THREE.Mesh(Capsule(0.10, neckLen), bodyMat);
    neckMesh.position.y = neckLen / 2;
    neck.add(neckMesh);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 24, 20), bodyMat);
    head.position.y = neckLen + headR;
    neck.add(head);

    // Shoulders attachment
    const shoulderW = 0.44;
    const shoulderY = chestLen * 0.78;

    const shoulderL = new THREE.Object3D();
    shoulderL.position.set(-shoulderW / 2, shoulderY, 0);
    chest.add(shoulderL);

    const shoulderR = new THREE.Object3D();
    shoulderR.position.set(shoulderW / 2, shoulderY, 0);
    chest.add(shoulderR);

    // Arms (upper+forearm) + hands
    function buildArm(side: "L" | "R") {
      const s = side === "L" ? -1 : 1;

      const upper = new THREE.Object3D();
      const upperMesh = new THREE.Mesh(Capsule(0.095, upperArm), jointMat);
      upperMesh.position.y = -upperArm / 2;
      upper.add(upperMesh);

      // deltoïde (épaule) – visuel musclé
      const delt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), jointMat);
      delt.scale.set(1.1, 0.95, 1.1);
      upper.add(delt);

      const elbow = new THREE.Object3D();
      elbow.position.y = -upperArm;
      upper.add(elbow);

      const fore = new THREE.Object3D();
      const foreMesh = new THREE.Mesh(Capsule(0.09, foreArm), jointMat);
      foreMesh.position.y = -foreArm / 2;
      fore.add(foreMesh);

      const wrist = new THREE.Object3D();
      wrist.position.y = -foreArm;
      fore.add(wrist);

      // main simple (pour “saisir” la barre)
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), jointMat);
      hand.position.set(0, -0.03, 0);
      wrist.add(hand);

      (side === "L" ? shoulderL : shoulderR).add(upper);
      elbow.add(fore);

      return { upper, elbow, fore, wrist, hand, sideSign: s };
    }

    const armL = buildArm("L");
    const armR = buildArm("R");

    // Hips & legs
    const hipW = 0.28;
    const hipL = new THREE.Object3D();
    hipL.position.set(-hipW / 2, 0.08, 0);
    pelvis.add(hipL);

    const hipR = new THREE.Object3D();
    hipR.position.set(hipW / 2, 0.08, 0);
    pelvis.add(hipR);

    function buildLeg(side: "L" | "R") {
      const s = side === "L" ? -1 : 1;

      const thigh = new THREE.Object3D();
      const thighMesh = new THREE.Mesh(Capsule(0.12, thighLen), jointMat);
      thighMesh.position.y = -thighLen / 2;
      thigh.add(thighMesh);

      const knee = new THREE.Object3D();
      knee.position.y = -thighLen;
      thigh.add(knee);

      const shin = new THREE.Object3D();
      const shinMesh = new THREE.Mesh(Capsule(0.105, shinLen), jointMat);
      shinMesh.position.y = -shinLen / 2;
      shin.add(shinMesh);

      const ankle = new THREE.Object3D();
      ankle.position.y = -shinLen;
      shin.add(ankle);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(footL, footH, 0.11), jointMat);
      foot.position.set(footL / 2 - 0.03, -footH / 2, 0);
      ankle.add(foot);

      (side === "L" ? hipL : hipR).add(thigh);
      knee.add(shin);

      return { thigh, knee, shin, ankle, foot, sideSign: s };
    }

    const legL = buildLeg("L");
    const legR = buildLeg("R");

    // Pull-up bar (visible seulement pour tractions)
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.95, 24), barMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 2.42, 0);
    bar.visible = false;
    scene.add(bar);

    // ---------- Camera controls ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2.2;
    controls.maxDistance = 6.0;
    controls.target.set(0, 0.7, 0);
    controls.update();

    // ---------- Pose helpers ----------
    const toRad = (d: number) => (d * Math.PI) / 180;
    const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, x)) * Math.PI); // ease-in-out
    const lerp = THREE.MathUtils.lerp;

    function setArm(
      arm: ReturnType<typeof buildArm>,
      shFlex: number, // + = vers l’avant
      shAbd: number,  // + = vers l’extérieur
      shRot: number,  // rot interne/extern visuelle
      elbowFlex: number
    ) {
      arm.upper.rotation.set(toRad(-shFlex), toRad(shRot * arm.sideSign), toRad(shAbd * arm.sideSign));
      arm.fore.rotation.set(toRad(-elbowFlex), 0, 0);
    }

    function setLeg(
      leg: ReturnType<typeof buildLeg>,
      hipFlex: number,  // + flex
      hipAbd: number,   // + abd
      kneeFlex: number, // + flex
      dorsiflex: number // + tibia vers l’avant
    ) {
      leg.thigh.rotation.set(toRad(-hipFlex), 0, toRad(hipAbd * leg.sideSign));
      leg.shin.rotation.set(toRad(kneeFlex), 0, 0);
      leg.ankle.rotation.set(toRad(-dorsiflex), 0, 0);
    }

    function neutral() {
      mannequin.position.set(0, 0, 0);
      mannequin.rotation.set(0, 0.12, 0);

      pelvis.rotation.set(0, 0, 0);
      spine.rotation.set(0, 0, 0);
      chest.rotation.set(0, 0, 0);
      neck.rotation.set(0, 0, 0);

      setArm(armL, 10, 8, 0, 15);
      setArm(armR, 10, -8, 0, 15);

      setLeg(legL, 0, 2, 0, 0);
      setLeg(legR, 0, -2, 0, 0);
    }
    neutral();

    // ---------- Exercise selection ----------
    const label = (exerciseOverride || analysis?.exercise || "").toLowerCase();
    const isPullup = /(traction|pull[\s-]?up|chin[\s-]?up)/.test(label);
    const isSquat = /(squat|goblet)/.test(label);
    const isHinge = /(soulev|deadlift|hinge|rdl|romanian)/.test(label);
    const isLunge = /(fente|lunge)/.test(label);
    const isPushup = /(pompe|push[\s-]?up)/.test(label);
    const isOHP = /(overhead|shoulder|développé)/.test(label);

    bar.visible = isPullup;

    // Position des mains sur barre (espacement épaules)
    const handSpread = 0.42;
    function attachHandsToBar() {
      armL.wrist.position.set(0, -foreArm, 0);
      armR.wrist.position.set(0, -foreArm, 0);
      // on “aligne” les mains sur la hauteur de la barre (en animation on ajuste les angles)
      armL.hand.position.set(0, -0.03, 0);
      armR.hand.position.set(0, -0.03, 0);
    }

    // ---------- Animate ----------
    const t0 = performance.now();
    let raf = 0;

    const animate = () => {
      const t = (performance.now() - t0) / 1000;

      // reset pose
      neutral();

      if (isPullup) {
        // cycle up/down
        const cyc = (t * 0.85) % 2; // 0..2
        const up = cyc < 1 ? ease(cyc) : ease(2 - cyc); // 0->1->0
        const scapSet = ease(Math.min(1, cyc * 1.3)); // engagement scapulaire en début de montée

        // mains “sur” la barre visuellement
        attachHandsToBar();

        // bras quasi tendus en bas -> forts coudes fléchis en haut
        const elbow = lerp(10, 130, up);
        // épaules en légère dépression + adduction quand on tire
        const shAbd = lerp(25, 10, up); // mains largeur épaules
        const shFlex = lerp(20, 35, up); // un peu de flexion à la montée
        const shRot = lerp(0, -10, up);

        setArm(armL, shFlex, shAbd, shRot, elbow);
        setArm(armR, shFlex, -shAbd, -shRot, elbow);

        // translation du corps : menton au-dessus de la barre au pic
        mannequin.position.y = lerp(-0.35, 0.2, up);

        // scapular depression/retraction: baisser épaules + gonfler poitrine
        chest.position.y = spineLen + lerp(0, 0.03, scapSet);
        chest.rotation.x = -toRad(lerp(2, 6, up));
        spine.rotation.x = -toRad(lerp(2, 6, up));

        // jambes tendues, pieds légèrement croisés
        setLeg(legL, 5, 2, 5, 0);
        setLeg(legR, 5, -2, 5, 0);
        legR.thigh.rotation.z = toRad(4);
        legL.thigh.rotation.z = toRad(-4);

        // place les mains sous la barre visuellement (alignement Z)
        const barY = bar.position.y;
        const worldToLocal = (y: number) => y - mannequin.position.y;
        armL.upper.parent!.updateMatrixWorld();
        armR.upper.parent!.updateMatrixWorld();
        // aligne l’extrémité du poignet proche de la barre sans calcul IK (démo simple)
        armL.upper.rotation.x = -toRad(shFlex);
        armR.upper.rotation.x = -toRad(shFlex);
        armL.upper.rotation.z = toRad(shAbd);
        armR.upper.rotation.z = toRad(-shAbd);
        armL.fore.rotation.x = -toRad(elbow);
        armR.fore.rotation.x = -toRad(elbow);

        // move wrists roughly to bar height (petit ajustement visuel)
        const wristY = worldToLocal(barY - 0.02);
        armL.wrist.position.y = -foreArm + (wristY - (chest.position.y + shoulderY));
        armR.wrist.position.y = -foreArm + (wristY - (chest.position.y + shoulderY));
        // écarte les mains sur X pour correspondre à la largeur de prise
        armL.upper.position.x = -handSpread / 2;
        armR.upper.position.x = handSpread / 2;
      } else if (isSquat) {
        const cyc = (t * 0.9) % 2;
        const depth = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const knee = lerp(5, 100, depth);
        const hip = lerp(0, 40, depth);
        const ankle = lerp(0, 12, depth);
        setLeg(legL, hip, 2, knee, ankle);
        setLeg(legR, hip, -2, knee, ankle);
        spine.rotation.x = -toRad(lerp(4, 14, depth));
        chest.rotation.x = -toRad(lerp(2, 10, depth));
        // bras en contrepoids
        setArm(armL, lerp(10, 40, depth), 8, 0, 15);
        setArm(armR, lerp(10, 40, depth), -8, 0, 15);
      } else if (isHinge) {
        const cyc = (t * 0.9) % 2;
        const amt = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const hip = lerp(5, 60, amt);
        const knee = lerp(5, 20, amt);
        const ankle = lerp(0, 8, amt);
        setLeg(legL, hip, 1, knee, ankle);
        setLeg(legR, hip, -1, knee, ankle);
        spine.rotation.x = -toRad(lerp(6, 26, amt));
        chest.rotation.x = -toRad(lerp(6, 20, amt));
        setArm(armL, 8, 4, 0, 10);
        setArm(armR, 8, -4, 0, 10);
      } else if (isLunge) {
        const alt = 0.5 + 0.5 * Math.sin(t * 1.2); // alterne jambe avant
        const kneeF = lerp(10, 95, alt);
        const hipF = lerp(0, 34, alt);
        const ankleF = lerp(0, 12, alt);
        setLeg(legL, hipF, 1, kneeF, ankleF);
        setLeg(legR, 10, -1, 15, 0);
        spine.rotation.y = toRad(6 * Math.sin(t * 0.8));
        setArm(armL, 18, 6, 0, 15);
        setArm(armR, 6, -6, 0, 12);
      } else if (isPushup) {
        const cyc = (t * 1.4) % 2;
        const press = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const elbow = lerp(10, 115, press);
        setArm(armL, 28, 18, 0, elbow);
        setArm(armR, 28, -18, 0, elbow);
        spine.rotation.x = -toRad(lerp(12, 26, press));
        chest.rotation.x = -toRad(lerp(8, 20, press));
        setLeg(legL, 6, 1, 10, 5);
        setLeg(legR, 6, -1, 10, 5);
      } else if (isOHP) {
        const cyc = (t * 1.1) % 2;
        const raise = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const shoulderFlex = lerp(30, 165, raise);
        const elbowFlex = lerp(20, 5, raise);
        setArm(armL, shoulderFlex, 12, 0, elbowFlex);
        setArm(armR, shoulderFlex, -12, 0, elbowFlex);
        spine.rotation.x = -toRad(lerp(0, 6, raise));
        setLeg(legL, 6, 2, 8, 3);
        setLeg(legR, 6, -2, 8, 3);
      } else {
        // idle respiratoire léger
        const r = 0.5 + 0.5 * Math.sin(t * 0.9);
        chest.position.y = spineLen + r * 0.01;
        chest.rotation.x = -toRad(2 + r * 2);
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

  const label = (exerciseOverride || analysis?.exercise || "exercice").trim();

  return (
    <div className="w-full">
      <div ref={mountRef} className="w-full h-[440px] rounded-xl border overflow-hidden" />
      <p className="text-xs text-muted-foreground mt-2">
        Mannequin 3D (démo) — <b>{label || "exercice"}</b>
      </p>
    </div>
  );
}
