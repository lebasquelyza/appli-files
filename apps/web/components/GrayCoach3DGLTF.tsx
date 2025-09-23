"use client";

import React, { useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface GrayCoach3DGLTFProps {
  analysis: any;
  exerciseOverride?: string;
}

export default function GrayCoach3DGLTF({
  analysis,
  exerciseOverride,
}: GrayCoach3DGLTFProps) {
  const exercise = exerciseOverride || analysis?.exercise || "inconnu";

  // Lumière ambiante
  const ambLight = useMemo(() => new THREE.AmbientLight(0xffffff, 0.6), []);
  useEffect(() => {
    return () => {
      // rien à disposer pour AmbientLight
    };
  }, []);

  // Directional light + shadow
  const dirLight = useMemo(() => {
    const l = new THREE.DirectionalLight(0xffffff, 1);
    l.position.set(5, 10, 5);
    l.castShadow = true;
    l.shadow.mapSize.width = 1024;
    l.shadow.mapSize.height = 1024;
    return l;
  }, []);
  useEffect(() => {
    return () => {
      // rien à disposer pour DirectionalLight
    };
  }, []);

  // Mannequin gris simplifié (cube)
  const mannequin = useMemo(() => {
    const group = new THREE.Group();

    const geom = new THREE.BoxGeometry(1, 2, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#aaaaaa") });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    group.add(mesh);

    // stocker refs pour cleanup
    (group as any).__geom = geom;
    (group as any).__mat = mat;

    return group;
  }, []);
  useEffect(() => {
    return () => {
      const g: any = mannequin as any;
      if (g?.__geom) g.__geom.dispose?.();
      if (g?.__mat) g.__mat.dispose?.();
    };
  }, [mannequin]);

  // Sol pour l’ombre (simple plane)
  const ground = useMemo(() => {
    const planeGeom = new THREE.PlaneGeometry(20, 20);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1.01;
    plane.receiveShadow = true;

    (plane as any).__geom = planeGeom;
    (plane as any).__mat = planeMat;

    return plane;
  }, []);
  useEffect(() => {
    return () => {
      const p: any = ground as any;
      if (p?.__geom) p.__geom.dispose?.();
      if (p?.__mat) p.__mat.dispose?.();
    };
  }, [ground]);

  return (
    <div className="w-full h-[400px] rounded-xl border overflow-hidden">
      <Canvas
        camera={{ position: [0, 1.5, 4], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        shadows
      >
        {/* On utilise des primitives Three.js pour éviter les balises JSX R3F typées */}
        <primitive object={ambLight} />
        <primitive object={dirLight} />
        <primitive object={ground} />
        <primitive object={mannequin} />

        <OrbitControls />
      </Canvas>

      <p className="text-center text-xs text-muted-foreground mt-2">
        Démonstration 3D de l’exercice : <b>{exercise}</b>
      </p>
    </div>
  );
}
