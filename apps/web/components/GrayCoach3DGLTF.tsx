"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/** 👇 Fix TS: allow <ambientLight/>, <directionalLight/>, etc. */
declare global {
  namespace JSX {
    // Merge R3F elements into JSX.IntrinsicElements
    interface IntrinsicElements
      extends import("@react-three/fiber").ThreeElements {}
  }
}

/* ...rest of your GrayCoach3DGLTF.tsx component code stays the same... */

// example (your existing JSX should now type-check):
export default function GrayCoach3DGLTF(props: { /* your props */ }) {
  return (
    <Canvas gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      {/* ... your scene ... */}
      <OrbitControls enablePan={false} />
    </Canvas>
  );
}
