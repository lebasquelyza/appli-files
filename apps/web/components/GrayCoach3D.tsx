// apps/web/components/GrayCoach3DGLTF.tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";

interface GrayCoach3DGLTFProps {
  analysis: any;
  exerciseOverride?: string;
}

export default function GrayCoach3DGLTF({
  analysis,
  exerciseOverride,
}: GrayCoach3DGLTFProps) {
  return (
    <div className="w-full h-[420px] rounded-2xl border overflow-hidden bg-black">
      <Canvas
        camera={{ position: [0, 1.6, 3], fov: 50 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Suspense fallback={null}>
          {/* Mannequin gris minimaliste */}
          <mesh castShadow receiveShadow>
            <capsuleGeometry args={[0.3, 1.2, 4, 16]} />
            <meshStandardMaterial color="#cccccc" metalness={0.2} roughness={0.8} />
          </mesh>
        </Suspense>
        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2} />
      </Canvas>
    </div>
  );
}
