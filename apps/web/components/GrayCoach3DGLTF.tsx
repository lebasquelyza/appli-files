"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  analysis: any;
  /** Exercice confirmé prioritaire */
  exerciseOverride?: string;
  /** Optionnel: "athletic" | "slim" | "curvy" */
  bodyType?: "athletic" | "slim" | "curvy";
};

/**
 * Mannequin 3D “humain”
 * - Morphologie lisible: tête/cou, tronc (pecs + lats), bassin,
 *   bras/avant-bras + mains, cuisses/mollets + pieds.
 * - Lignes d’arêtes (wire) pour renforcer la lecture “humain”.
 * - Animations démos crédibles: pull-up, squat, hinge, lunge, push-up, OHP.
 * - Three.js pur (aucune dépendance R3F) => compatible build Netlify.
 */
export default function GrayCoach3DGLTF({
  analysis,
  exerciseOverride,
  bodyType = "athletic",
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ---------- Renderer / Scene / Camera ----------
    const w = container.clientWidth || 640;
    const h = container.clientHeight || 440;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0b);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.set(2.8, 1.9, 3.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // ---------- Lights (key + rim + hemi) ----------
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 6, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(-4, 4.5, -3);
    scene.add(rim);
    const hemi = new THREE.HemisphereLight(0xeeeeff, 0x111118, 0.35);
    scene.add(hemi);

    // ---------- Sol + horizon ----------
    const floorY = -1.12;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = floorY;
    scene.add(ground);

    const horizon = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 20),
      new THREE.MeshBasicMaterial({ color: 0x0e0e0e })
    );
    horizon.position.set(0, 2.2, -6.5);
    scene.add(horizon);

    // ---------- Matériaux ----------
    const base = new THREE.Color(0xbdbdbd);     // peau grise claire
    const joint = new THREE.Color(0x969696);    // articulations
    const dark = new THREE.Color(0x6a6a6a);     // accessoires
    const bodyMat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.6, metalness: 0.15 });
    const jointMat = new THREE.MeshStandardMaterial({ color: joint, roughness: 0.6, metalness: 0.2 });
    const accentMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.5, metalness: 0.4 });

    // ---------- Helper geom ----------
    const Capsule =
      (THREE as any).CapsuleGeometry
        ? (r = 0.2, h = 1, sr = 14, sh = 18) => new (THREE as any).CapsuleGeometry(r, Math.max(h - 2 * r, 0.0001), sr, sh)
        : (r = 0.2, h = 1, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg);

    // ---------- Proportions selon bodyType ----------
    const scaleMul =
      bodyType === "slim" ? 0.92 :
      bodyType === "curvy" ? 1.08 : 1.0;

    // hauteurs/longueurs de base (taille ~1.78 m fictive)
    const headR = 0.115 * scaleMul;
    const neckLen = 0.11 * scaleMul;
    const chestLen = 0.30 * scaleMul;
    const spineLen = 0.50 * scaleMul;
    const pelvisDrop = -0.12 * scaleMul;

    const upperArm = 0.32 * scaleMul;
    const foreArm = 0.29 * scaleMul;
    const thighLen = 0.45 * scaleMul;
    const shinLen = 0.44 * scaleMul;

    // ---------- Rig complet ----------
    const mannequin = new THREE.Group();
    scene.add(mannequin);

    // Bassin (forme lisible)
    const pelvis = new THREE.Object3D();
    pelvis.position.set(0, pelvisDrop, 0);
    mannequin.add(pelvis);

    const pelvisMesh = new THREE.Mesh(Capsule(0.24 * scaleMul, 0.22 * scaleMul), bodyMat);
    pelvisMesh.scale.set(1.15, 1, 1.05); // largeur bassin
    pelvisMesh.position.y = 0.12 * scaleMul;
    pelvis.add(pelvisMesh);

    // Colonne + cage thoracique “athlétique” (pecs/lats)
    const spine = new THREE.Object3D();
    spine.position.y = 0.02 * scaleMul;
    pelvis.add(spine);

    const spineMesh = new THREE.Mesh(Capsule(0.18 * scaleMul, spineLen), bodyMat);
    spineMesh.position.y = spineLen / 2;
    spine.add(spineMesh);

    const chest = new THREE.Object3D();
    chest.position.y = spineLen;
    spine.add(chest);

    const ribcage = new THREE.Mesh(Capsule(0.23 * scaleMul, chestLen), bodyMat);
    ribcage.position.y = chestLen / 2;
    ribcage.scale.set(1.18, 1, 1.06); // épaules
    chest.add(ribcage);

    // Pectoraux (volume lisible)
    const pecs = new THREE.Mesh(new THREE.SphereGeometry(0.17 * scaleMul, 20, 16), bodyMat);
    pecs.scale.set(1.35, 0.6, 0.9);
    pecs.position.set(0, chestLen * 0.62, 0.10);
    chest.add(pecs);

    // Lats (dos en V)
    const lats = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scaleMul, 18, 14), bodyMat);
    lats.scale.set(1.4, 0.6, 0.8);
    lats.position.set(0, chestLen * 0.35, -0.06);
    chest.add(lats);

    // Cou + tête + traits (yeux) pour “humain”
    const neck = new THREE.Object3D();
    neck.position.y = chestLen;
    chest.add(neck);

    const neckMesh = new THREE.Mesh(Capsule(0.10 * scaleMul, neckLen), bodyMat);
    neckMesh.position.y = neckLen / 2;
    neck.add(neckMesh);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 28, 22), bodyMat);
    head.position.y = neckLen + headR;
    neck.add(head);

    // yeux (deux disques sombres)
    const eyeGeo = new THREE.CircleGeometry(0.018 * scaleMul, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x3f3f3f });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.035 * scaleMul, headR * 0.15, headR * 0.96);
    eyeR.position.set( 0.035 * scaleMul, headR * 0.15, headR * 0.96);
    head.add(eyeL, eyeR);

    // Épaules
    const shoulderW = 0.46 * scaleMul;
    const shoulderY = chestLen * 0.78;

    const shoulderL = new THREE.Object3D();
    shoulderL.position.set(-shoulderW / 2, shoulderY, 0);
    chest.add(shoulderL);

    const shoulderR = new THREE.Object3D();
    shoulderR.position.set(shoulderW / 2, shoulderY, 0);
    chest.add(shoulderR);

    // Bras
    function buildArm(side: "L" | "R") {
      const upper = new THREE.Object3D();
      const upperMesh = new THREE.Mesh(Capsule(0.10 * scaleMul, upperArm), jointMat);
      upperMesh.position.y = -upperArm / 2;
      upper.add(upperMesh);

      // deltoïde (boule épaissie)
      const delt = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scaleMul, 16, 14), jointMat);
      upper.add(delt);

      const elbow = new THREE.Object3D();
      elbow.position.y = -upperArm;
      upper.add(elbow);

      const fore = new THREE.Object3D();
      const foreMesh = new THREE.Mesh(Capsule(0.095 * scaleMul, foreArm), jointMat);
      foreMesh.position.y = -foreArm / 2;
      fore.add(foreMesh);

      const wrist = new THREE.Object3D();
      wrist.position.y = -foreArm;
      fore.add(wrist);

      // main (paume + phalanges simples)
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.13 * scaleMul, 0.06 * scaleMul, 0.085 * scaleMul), jointMat);
      palm.position.set(0, -0.03 * scaleMul, 0.0);
      wrist.add(palm);

      // pouce indicatif
      const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * scaleMul, 0.018 * scaleMul, 0.08 * scaleMul, 10), jointMat);
      thumb.rotation.z = -Math.PI / 3;
      thumb.position.set(0.06 * scaleMul * (side === "L" ? -1 : 1), -0.02 * scaleMul, 0.03 * scaleMul);
      wrist.add(thumb);

      (side === "L" ? shoulderL : shoulderR).add(upper);
      elbow.add(fore);

      return { upper, elbow, fore, wrist, hand: palm, side: side === "L" ? -1 : 1 };
    }

    const armL = buildArm("L");
    const armR = buildArm("R");

    // Hanches & jambes
    const hipW = 0.30 * scaleMul;
    const hipL = new THREE.Object3D();
    hipL.position.set(-hipW / 2, 0.09 * scaleMul, 0);
    pelvis.add(hipL);

    const hipR = new THREE.Object3D();
    hipR.position.set( hipW / 2, 0.09 * scaleMul, 0);
    pelvis.add(hipR);

    function buildLeg(side: "L" | "R") {
      const thigh = new THREE.Object3D();
      const thighMesh = new THREE.Mesh(Capsule(0.13 * scaleMul, thighLen), jointMat);
      thighMesh.position.y = -thighLen / 2;
      thigh.add(thighMesh);

      const knee = new THREE.Object3D();
      knee.position.y = -thighLen;
      thigh.add(knee);

      const shin = new THREE.Object3D();
      const shinMesh = new THREE.Mesh(Capsule(0.11 * scaleMul, shinLen), jointMat);
      shinMesh.position.y = -shinLen / 2;
      shin.add(shinMesh);

      const ankle = new THREE.Object3D();
      ankle.position.y = -shinLen;
      shin.add(ankle);

      // pied (forme “sneaker”)
      const footLen = 0.26 * scaleMul;
      const footH = 0.075 * scaleMul;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(footLen, footH, 0.12 * scaleMul), jointMat);
      foot.position.set(footLen / 2 - 0.04 * scaleMul, -footH / 2, 0);
      ankle.add(foot);

      (side === "L" ? hipL : hipR).add(thigh);
      knee.add(shin);

      return { thigh, knee, shin, ankle, foot, side: side === "L" ? -1 : 1 };
    }

    const legL = buildLeg("L");
    const legR = buildLeg("R");

    // Barre pour tractions
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scaleMul, 0.03 * scaleMul, 2.0, 24), accentMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 2.45 * scaleMul, 0);
    bar.visible = false;
    scene.add(bar);

    // ---------- Edges overlay (renforce silhouette humaine) ----------
    function addEdges(mesh: THREE.Mesh, color = 0x2c2c2c, opacity = 0.35) {
      const e = new THREE.EdgesGeometry(mesh.geometry, 40);
      const l = new THREE.LineSegments(
        e,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity })
      );
      mesh.add(l);
    }
    [pelvisMesh, spineMesh, ribcage, pecs, lats, head].forEach((m) => addEdges(m as THREE.Mesh));

    // ---------- Helpers pose ----------
    const rad = (d: number) => (d * Math.PI) / 180;
    const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, x)) * Math.PI);
    const L = THREE.MathUtils.lerp;

    function setArm(
      arm: ReturnType<typeof buildArm>,
      shFlex: number, // + vers l’avant
      shAbd: number,  // + écarter
      shRot: number,  // rotation interne/externe
      elbowFlex: number
    ) {
      arm.upper.rotation.set(-rad(shFlex), rad(shRot * arm.side), rad(shAbd * arm.side));
      arm.fore.rotation.set(-rad(elbowFlex), 0, 0);
    }

    function setLeg(
      leg: ReturnType<typeof buildLeg>,
      hipFlex: number,
      hipAbd: number,
      kneeFlex: number,
      dorsiflex: number
    ) {
      leg.thigh.rotation.set(-rad(hipFlex), 0, rad(hipAbd * leg.side));
      leg.shin.rotation.set(rad(kneeFlex), 0, 0);
      leg.ankle.rotation.set(-rad(dorsiflex), 0, 0);
    }

    function neutral() {
      mannequin.position.set(0, 0, 0);
      mannequin.rotation.set(0, 0.1, 0);

      pelvis.rotation.set(0, 0, 0);
      spine.rotation.set(0, 0, 0);
      chest.rotation.set(0, 0, 0);
      neck.rotation.set(0, 0, 0);

      setArm(armL, 10, 10, 0, 12);
      setArm(armR, 10, -10, 0, 12);

      setLeg(legL, 0, 2, 5, 0);
      setLeg(legR, 0, -2, 5, 0);
    }
    neutral();

    // ---------- Choix d’exercice ----------
    const label = (exerciseOverride || analysis?.exercise || "").toLowerCase();
    const isPullup = /(traction|pull[\s-]?up|chin[\s-]?up)/.test(label);
    const isSquat = /(squat|goblet)/.test(label);
    const isHinge = /(soulev|deadlift|hinge|rdl|romanian)/.test(label);
    const isLunge = /(fente|lunge)/.test(label);
    const isPushup = /(pompe|push[\s-]?up)/.test(label);
    const isOHP = /(overhead|shoulder|développé)/.test(label);

    bar.visible = isPullup;

    // largeur de prise pour la traction
    const grip = 0.42 * scaleMul;

    function handsToBar() {
      armL.wrist.position.set(0, -foreArm, 0);
      armR.wrist.position.set(0, -foreArm, 0);
      armL.upper.position.x = -grip / 2;
      armR.upper.position.x = grip / 2;
    }

    // ---------- Animation ----------
    const t0 = performance.now();
    let raf = 0;

    const render = () => {
      const t = (performance.now() - t0) / 1000;

      neutral();

      if (isPullup) {
        const cyc = (t * 0.85) % 2;
        const up = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const scap = ease(Math.min(1, cyc * 1.2));

        handsToBar();

        const elbow = L(10, 130, up);
        const shAbd = L(20, 10, up);
        const shFlex = L(20, 40, up);
        const shRot = L(0, -10, up);

        setArm(armL, shFlex, shAbd, shRot, elbow);
        setArm(armR, shFlex, -shAbd, -shRot, elbow);

        // translation corps pour menton au-dessus de la barre
        mannequin.position.y = L(-0.35 * scaleMul, 0.2 * scaleMul, up);

        // poitrine ouverte + dépression scapulaire
        chest.position.y = spineLen + L(0, 0.03, scap);
        chest.rotation.x = -rad(L(2, 6, up));
        spine.rotation.x = -rad(L(2, 6, up));

        // jambes tendues, pieds légèrement croisés
        setLeg(legL, 5, 2, 5, 0);
        setLeg(legR, 5, -2, 5, 0);
        legR.thigh.rotation.z = rad(4);
        legL.thigh.rotation.z = rad(-4);
      } else if (isSquat) {
        const cyc = (t * 0.9) % 2;
        const depth = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const knee = L(8, 105, depth);
        const hip = L(0, 42, depth);
        const ankle = L(0, 12, depth);
        setLeg(legL, hip, 2, knee, ankle);
        setLeg(legR, hip, -2, knee, ankle);
        spine.rotation.x = -rad(L(4, 16, depth));
        chest.rotation.x = -rad(L(2, 12, depth));
        setArm(armL, L(10, 38, depth), 10, 0, 12);
        setArm(armR, L(10, 38, depth), -10, 0, 12);
      } else if (isHinge) {
        const cyc = (t * 0.9) % 2;
        const amt = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const hip = L(6, 62, amt);
        const knee = L(6, 20, amt);
        setLeg(legL, hip, 1, knee, 6);
        setLeg(legR, hip, -1, knee, 6);
        spine.rotation.x = -rad(L(8, 28, amt));
        chest.rotation.x = -rad(L(6, 22, amt));
        setArm(armL, 8, 4, 0, 10);
        setArm(armR, 8, -4, 0, 10);
      } else if (isLunge) {
        const alt = 0.5 + 0.5 * Math.sin(t * 1.15);
        const kneeF = L(12, 98, alt);
        const hipF = L(0, 36, alt);
        const ankleF = L(0, 12, alt);
        setLeg(legL, hipF, 1, kneeF, ankleF);
        setLeg(legR, 12, -1, 16, 3);
        spine.rotation.y = rad(6 * Math.sin(t * 0.9));
        setArm(armL, 18, 6, 0, 14);
        setArm(armR, 6, -6, 0, 12);
      } else if (isPushup) {
        const cyc = (t * 1.35) % 2;
        const press = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const elbow = L(10, 115, press);
        setArm(armL, 30, 18, 0, elbow);
        setArm(armR, 30, -18, 0, elbow);
        spine.rotation.x = -rad(L(10, 26, press));
        chest.rotation.x = -rad(L(8, 20, press));
        setLeg(legL, 6, 1, 10, 5);
        setLeg(legR, 6, -1, 10, 5);
      } else if (isOHP) {
        const cyc = (t * 1.05) % 2;
        const raise = cyc < 1 ? ease(cyc) : ease(2 - cyc);
        const shoulderFlex = L(32, 170, raise);
        const elbowFlex = L(20, 8, raise);
        setArm(armL, shoulderFlex, 10, 0, elbowFlex);
        setArm(armR, shoulderFlex, -10, 0, elbowFlex);
        spine.rotation.x = -rad(L(0, 6, raise));
        setLeg(legL, 6, 2, 8, 3);
        setLeg(legR, 6, -2, 8, 3);
      } else {
        // respiration subtile (idle)
        const r = 0.5 + 0.5 * Math.sin(t * 0.9);
        chest.position.y = spineLen + r * 0.012;
        chest.rotation.x = -rad(2 + r * 2.5);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    // ---------- Resize ----------
    const onResize = () => {
      const W = container.clientWidth || 640;
      const H = container.clientHeight || 440;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    render();

    // ---------- Cleanup ----------
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [analysis, exerciseOverride, bodyType]);

  const label = (exerciseOverride || analysis?.exercise || "exercice").trim() || "exercice";

  return (
    <div className="w-full">
      <div ref={mountRef} className="w-full h-[460px] rounded-xl border overflow-hidden" />
      <p className="text-xs text-muted-foreground mt-2">
        Mannequin 3D (démo) — <b>{label}</b>
      </p>
    </div>
  );
}
