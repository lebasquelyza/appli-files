"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/** ✅ Fix TS sur Netlify: déclaration des éléments JSX de R3F */
import type { ThreeElements } from "@react-three/fiber";

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

interface GrayCoach3DGLTFProps {
  analysis: any;
  exerciseOverride?: string;
}

export default function GrayCoach3DGLTF({
  analysis,
  exerciseOverride,
}: GrayCoach3DGLTFProps) {
  const exercise = exerciseOverride || analysis?.exercise || "inconnu";

  return (
    <div className="w-full h-[400px] rounded-xl border overflow-hidden">
      <Canvas
        camera={{ position: [0, 1.5, 4], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        {/* Lumières */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* Mannequin simple = cube gris (placeholder) */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 2, 0.5]} />
          <meshStandardMaterial color="#aaa" />
        </mesh>

        {/* Contrôles caméra */}
        <OrbitControls />
      </Canvas>
      <p className="text-center text-xs text-muted-foreground mt-2">
        Démonstration 3D de l’exercice : <b>{exercise}</b>
      </p>
    </div>
  );
}
