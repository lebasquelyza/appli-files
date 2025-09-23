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
 * Démo 3D “mannequin gris” SANS react-three-fiber (Three.js pur).
 * -> Aucun tag JSX R3F (pas de <primitive/>, <ambientLight/>, etc.) => plus d’erreurs de types côté Netlify.
 */
export default function GrayCoach3DGLTF({ analysis, exerciseOverride }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Base Three ---
    const container = mountRef.current;
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0b);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.6, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // --- Lumières ---
    const amb = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 5);
    scene.add(dir);

    // --- Sol -- (simple plan)
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.02;
    scene.add(ground);

    // --- Mannequin gris simplifié ---
    const mannequin = new THREE.Group();
    scene.add(mannequin);

    // tronc (capsule si dispo, sinon cylindre)
    let trunk: THREE.Mesh;
    if ((THREE as any).CapsuleGeometry) {
      trunk = new THREE.Mesh(
        new (THREE as any).CapsuleGeometry(0.35, 1.0, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.1, roughness: 0.8 })
      );
    } else {
      trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 1.4, 16),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.1, roughness: 0.8 })
      );
    }
    trunk.position.set(0, 0.2, 0);
    mannequin.add(trunk);

    // tête (sphère)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.1, roughness: 0.8 })
    );
    head.position.set(0, 1.1, 0);
    mannequin.add(head);

    // bras (cylindres)
    const armMat = new THREE.MeshStandardMaterial({ color: 0x9c9c9c, metalness: 0.1, roughness: 0.8 });
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 12), armMat);
    leftArm.position.set(-0.55, 0.55, 0);
    leftArm.rotation.z = Math.PI / 2.2;
    mannequin.add(leftArm);

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.55;
    rightArm.rotation.z = -Math.PI / 2.2;
    mannequin.add(rightArm);

    // jambes (cylindres)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.1, roughness: 0.9 });
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 12), legMat);
    leftLeg.position.set(-0.22, -0.75, 0);
    mannequin.add(leftLeg);

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.22;
    mannequin.add(rightLeg);

    // barre de traction (si traction)
    const barMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.4 });
    const pullupBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 12), barMat);
    pullupBar.rotation.z = Math.PI / 2;
    pullupBar.position.set(0, 2.2, 0);
    scene.add(pullupBar);
    pullupBar.visible = false;

    // Contrôles cam (orbite — pour la démo)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // --- Animation selon l’exercice confirmé ---
    const exerciseRaw = (exerciseOverride || analysis?.exercise || "").toLowerCase();
    const isPullup = /(traction|pull[\s-]?up|chin[\s-]?up)/.test(exerciseRaw);
    const isSquat = /(squat|goblet)/.test(exerciseRaw);
    const isHinge = /(soulev|deadlift|hinge|rdl|romanian)/.test(exerciseRaw);
    const isLunge = /(fente|lunge)/.test(exerciseRaw);
    const isPushup = /(pompe|push[\s-]?up)/.test(exerciseRaw);
    const isOHP = /(overhead|shoulder|développé)/.test(exerciseRaw);

    // configure bar visibility only for pull-ups
    pullupBar.visible = isPullup;

    let raf = 0;
    const tStart = performance.now();

    const animate = () => {
      const t = (performance.now() - tStart) / 1000; // secondes

      // Mouvement “démo” simple selon exo
      if (isPullup) {
        // Tractions : corps monte/descend + bras qui se plient
        const y = -0.4 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2));
        mannequin.position.set(0, y, 0);

        leftArm.rotation.z = Math.PI / 2.2 - 0.8 * (0.5 + 0.5 * Math.sin(t * 2));
        rightArm.rotation.z = -Math.PI / 2.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 2));
      } else if (isSquat) {
        // Squat : descente/montee
        const depth = 0.4 * (0.5 + 0.5 * Math.sin(t * 2));
        mannequin.position.y = -depth;
        trunk.rotation.x = -0.15 * depth;
      } else if (isHinge) {
        // Hinge / Deadlift : flexion de hanches
        const hinge = 0.6 * (0.5 + 0.5 * Math.sin(t * 2));
        trunk.rotation.x = 0.2 + 0.5 * hinge; // buste s’incline
        mannequin.position.y = -0.2 * hinge;
      } else if (isLunge) {
        // Fente : petit va-et-vient vertical + légère alternance
        const y = 0.25 * (0.5 + 0.5 * Math.sin(t * 2));
        mannequin.position.y = -y;
        mannequin.rotation.y = 0.15 * Math.sin(t * 0.8);
      } else if (isPushup) {
        // Pompes : on simule en relevant/abaissant le buste
        const press = 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2));
        trunk.rotation.x = -0.2 - 0.7 * press;
        mannequin.position.y = -0.3 * press;
      } else if (isOHP) {
        // Développé militaire : bras montent/descendent
        const raise = 0.7 * (0.5 + 0.5 * Math.sin(t * 2));
        leftArm.rotation.z = -0.3 + 0.9 * raise;
        rightArm.rotation.z = 0.3 - 0.9 * raise;
      } else {
        // défaut : léger balancement
        mannequin.rotation.y = 0.2 * Math.sin(t * 0.7);
      }

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    // Resize
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 400;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      groundGeo.dispose();
      (groundMat as any).dispose?.();
      (trunk.geometry as any).dispose?.();
      (trunk.material as any).dispose?.();
      (head.geometry as any).dispose?.();
      (head.material as any).dispose?.();
      (leftArm.geometry as any).dispose?.();
      (leftArm.material as any).dispose?.();
      // rightArm partage la même géométrie/matériau que leftArm (cloné), pas besoin de disposer deux fois
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [analysis, exerciseOverride]);

  const exercise = (exerciseOverride || analysis?.exercise || "exercice").trim();

  return (
    <div>
      <div ref={mountRef} className="w-full h-[400px] rounded-xl border overflow-hidden" />
      <p className="text-center text-xs text-muted-foreground mt-2">
        Démonstration 3D de l’exercice : <b>{exercise}</b>
      </p>
    </div>
  );
}
