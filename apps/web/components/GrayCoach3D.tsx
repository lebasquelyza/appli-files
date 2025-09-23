"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import * as THREE from "three";
import React, { useMemo, useRef, useState } from "react";

/* ===== Types minimaux (compatibles avec ton analysis) ===== */
type Fault = { issue: string; severity: "faible" | "moyenne" | "élevée" };
type AIAnalysis = { exercise: string; movement_pattern?: string; faults?: Fault[] };

/* ===== Public API ===== */
export default function GrayCoach3D({
  analysis,
  height = 420,
}: {
  analysis: AIAnalysis;
  height?: number;
}) {
  const preset = choosePreset(analysis);
  const [speed, setSpeed] = useState(1);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">
          Mouvement corrigé&nbsp;: <span className="font-medium">{label(analysis.exercise || analysis.movement_pattern || "Exercice")}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>Vitesse</span>
          <input
            type="range"
            min={0.4}
            max={2}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-40"
          />
          <span>{speed.toFixed(1)}x</span>
        </div>
      </div>

      {/* Canvas 3D */}
      <div style={{ height }} className="relative w-full rounded-2xl border overflow-hidden bg-black">
        <Canvas
          shadows
          camera={{ position: [2.2, 1.9, 3.2], fov: 50 }}
          gl={{ antialias: true }}
        >
          {/* Lumière */}
          <hemisphereLight args={["#999", "#222", 0.9]} />
          <directionalLight
            castShadow
            position={[4, 6, 3]}
            intensity={1.2}
            shadow-mapSize={[1024, 1024]}
          />

          {/* Sol */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#0f0f0f" roughness={1} metalness={0} />
          </mesh>

          {/* Décor selon preset */}
          {preset === "pullup" && <PullupBar />}

          {/* Mannequin animé */}
          <Mannequin preset={preset} speed={speed} />

          {/* Caméra orbit libre (on peut limiter pour mobile si tu veux) */}
          <OrbitControls
            enablePan={false}
            minDistance={2.2}
            maxDistance={5.5}
            maxPolarAngle={Math.PI * 0.49}
          />

          {/* Léger environnement pour des reflets doux */}
          <Environment preset="city" blur={0.8} />
        </Canvas>

        {/* Badge */}
        <div className="absolute top-2 left-2 rounded-md bg-black/60 text-white text-[11px] px-2 py-1">
          Silhouette 3D corrigée (mannequin)
        </div>
      </div>
    </div>
  );
}

/* ====== Décor : barre de traction ====== */
function PullupBar() {
  return (
    <group position={[0, 2.2, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.03, 0.03, 3.2, 24]} />
        <meshStandardMaterial color="#7a7a7a" metalness={0.6} roughness={0.2} />
      </mesh>
      {/* poteaux (indicatifs) */}
      <group position={[-1.55, -1.1, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.035, 0.035, 2.2, 24]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </group>
      <group position={[1.55, -1.1, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.035, 0.035, 2.2, 24]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </group>
    </group>
  );
}

/* ====== Mannequin procédural (capsules/boîtes) ====== */
type PresetName = "pullup" | "pushup" | "squat" | "hinge" | "lunge" | "ohp" | "row" | "hipthrust";

function Mannequin({ preset, speed }: { preset: PresetName; speed: number }) {
  // groupes pour animer les membres
  const root = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Mesh>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const foreL = useRef<THREE.Group>(null!);
  const foreR = useRef<THREE.Group>(null!);
  const thighL = useRef<THREE.Group>(null!);
  const thighR = useRef<THREE.Group>(null!);
  const shinL = useRef<THREE.Group>(null!);
  const shinR = useRef<THREE.Group>(null!);

  // géométries/matériaux partagés (gris mat)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#bcbcbc", roughness: 0.8, metalness: 0.05 }), []);
  const geoCaps = useMemo(() => new THREE.CapsuleGeometry(0.09, 0.4, 8, 16), []);
  const geoShortCaps = useMemo(() => new THREE.CapsuleGeometry(0.085, 0.26, 8, 16), []);
  const geoTorso = useMemo(() => new THREE.CapsuleGeometry(0.16, 0.6, 12, 24), []);
  const geoHead = useMemo(() => new THREE.SphereGeometry(0.13, 24, 24), []);

  // animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed;
    const ph = (Math.sin(t * 2.2) + 1) / 2; // 0..1

    // reset poses de base
    root.current.position.set(0, 1.0, 0);
    torso.current.rotation.set(0, 0, 0);
    head.current.rotation.set(0, 0, 0);

    // membres par défaut (debout)
    setRot(armL, -0.2, 0, 0.15);
    setRot(armR, -0.2, 0, -0.15);
    setRot(foreL, -0.3, 0, 0);
    setRot(foreR, -0.3, 0, 0);
    setRot(thighL, 0, 0, 0.12);
    setRot(thighR, 0, 0, -0.12);
    setRot(shinL, 0, 0, 0);
    setRot(shinR, 0, 0, 0);

    // appliquer le preset
    if (preset === "pullup") {
      // positionne sous la barre
      root.current.position.y = THREE.MathUtils.lerp(0.7, 1.3, ph);

      // bras : mains imaginaires sur la barre => avant-bras qui se plient
      setRot(armL, THREE.MathUtils.lerp(-1.0, -0.2, ph), 0, 0.25);
      setRot(armR, THREE.MathUtils.lerp(-1.0, -0.2, ph), 0, -0.25);
      setRot(foreL, THREE.MathUtils.lerp(-1.3, -0.4, ph), 0, 0);
      setRot(foreR, THREE.MathUtils.lerp(-1.3, -0.4, ph), 0, 0);

      // jambes légèrement pliées en haut
      setRot(thighL, THREE.MathUtils.lerp(0.1, 0.35, ph), 0, 0.12);
      setRot(thighR, THREE.MathUtils.lerp(-0.1, 0.25, ph), 0, -0.12);
      setRot(shinL, THREE.MathUtils.lerp(0.1, 0.25, ph), 0, 0);
      setRot(shinR, THREE.MathUtils.lerp(0.1, 0.25, ph), 0, 0);
    }

    if (preset === "pushup") {
      // corps bascule en planche + descente/montee
      root.current.position.set(0, 0.65, 0);
      torso.current.rotation.x = -0.25;
      head.current.rotation.x = 0.05;

      // descente -> ph -> bras se plient
      setRot(armL, THREE.MathUtils.lerp(-0.4, -1.2, ph), 0.15, 0.2);
      setRot(armR, THREE.MathUtils.lerp(-0.4, -1.2, ph), -0.15, -0.2);
      setRot(foreL, THREE.MathUtils.lerp(-0.4, -1.0, ph), 0, 0);
      setRot(foreR, THREE.MathUtils.lerp(-0.4, -1.0, ph), 0, 0);

      // jambes droites
      setRot(thighL, -0.1, 0, 0.1);
      setRot(thighR, -0.1, 0, -0.1);
      setRot(shinL, 0.15, 0, 0);
      setRot(shinR, 0.15, 0, 0);
    }

    if (preset === "squat") {
      const bend = THREE.MathUtils.lerp(0.05, 0.9, ph);
      setRot(thighL, bend, 0, 0.2);
      setRot(thighR, bend, 0, -0.2);
      setRot(shinL, -bend * 0.7, 0, 0);
      setRot(shinR, -bend * 0.7, 0, 0);
      root.current.position.y = 1.0 - bend * 0.25;
      torso.current.rotation.x = -bend * 0.15; // buste légèrement incliné
    }

    if (preset === "hinge") {
      const tilt = THREE.MathUtils.lerp(0, 0.5, ph);
      torso.current.rotation.x = -tilt;
      setRot(thighL, THREE.MathUtils.lerp(0.1, 0.35, ph), 0, 0.12);
      setRot(thighR, THREE.MathUtils.lerp(0.1, 0.35, ph), 0, -0.12);
      setRot(shinL, -tilt * 0.4, 0, 0);
      setRot(shinR, -tilt * 0.4, 0, 0);
    }

    if (preset === "lunge") {
      const step = THREE.MathUtils.lerp(0.1, 0.7, ph);
      setRot(thighL, step, 0, 0.15);
      setRot(thighR, -step * 0.6, 0, -0.15);
      setRot(shinL, -step * 0.65, 0, 0);
      setRot(shinR, step * 0.4, 0, 0);
      torso.current.rotation.x = -step * 0.1;
      root.current.position.y = 1 - step * 0.15;
    }

    if (preset === "ohp") {
      // bras montent au-dessus de la tête
      setRot(armL, THREE.MathUtils.lerp(-0.4, -2.0, ph), 0.2, 0.0);
      setRot(armR, THREE.MathUtils.lerp(-0.4, -2.0, ph), -0.2, 0.0);
      setRot(foreL, THREE.MathUtils.lerp(-0.4, -0.1, ph), 0, 0);
      setRot(foreR, THREE.MathUtils.lerp(-0.4, -0.1, ph), 0, 0);
    }

    if (preset === "row") {
      const pull = THREE.MathUtils.lerp(0.2, 1.0, ph);
      torso.current.rotation.x = -0.35;
      setRot(armL, -0.8 + pull * 0.5, 0.15, 0.2);
      setRot(armR, -0.8 + pull * 0.5, -0.15, -0.2);
      setRot(foreL, -0.6 + pull * 0.7, 0, 0);
      setRot(foreR, -0.6 + pull * 0.7, 0, 0);
      setRot(thighL, 0.35, 0, 0.12);
      setRot(thighR, 0.35, 0, -0.12);
      setRot(shinL, -0.2, 0, 0);
      setRot(shinR, -0.2, 0, 0);
    }

    if (preset === "hipthrust") {
      const up = THREE.MathUtils.lerp(0, 0.5, ph);
      torso.current.rotation.x = up * 0.8;
      root.current.position.y = 0.8 + up * 0.2;
      setRot(thighL, -up * 0.2, 0, 0.1);
      setRot(thighR, -up * 0.2, 0, -0.1);
      setRot(shinL, up * 0.5, 0, 0);
      setRot(shinR, up * 0.5, 0, 0);
    }
  });

  return (
    <group ref={root} position={[0, 1, 0]}>
      {/* Tronc + tête */}
      <group ref={torso}>
        <mesh castShadow geometry={geoTorso} material={mat} />
        <mesh ref={head} castShadow position={[0, 0.52, 0]} geometry={geoHead} material={mat} />
      </group>

      {/* Bras gauche */}
      <group ref={armL} position={[-0.25, 0.2, 0]}>
        <mesh castShadow geometry={geoShortCaps} material={mat} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <group ref={foreL} position={[-0.5, 0.1, 0]}>
        <mesh castShadow geometry={geoShortCaps} material={mat} rotation={[0, 0, Math.PI / 2]} />
      </group>

      {/* Bras droit */}
      <group ref={armR} position={[0.25, 0.2, 0]}>
        <mesh castShadow geometry={geoShortCaps} material={mat} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <group ref={foreR} position={[0.5, 0.1, 0]}>
        <mesh castShadow geometry={geoShortCaps} material={mat} rotation={[0, 0, Math.PI / 2]} />
      </group>

      {/* Jambe gauche */}
      <group ref={thighL} position={[-0.12, -0.35, 0]}>
        <mesh castShadow geometry={geoCaps} material={mat} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <group ref={shinL} position={[-0.12, -0.75, 0]}>
        <mesh castShadow geometry={geoCaps} material={mat} rotation={[0, 0, Math.PI / 2]} />
      </group>

      {/* Jambe droite */}
      <group ref={thighR} position={[0.12, -0.35, 0]}>
        <mesh castShadow geometry={geoCaps} material={mat} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <group ref={shinR} position={[0.12, -0.75, 0]}>
        <mesh castShadow geometry={geoCaps} material={mat} rotation={[0, 0, Math.PI / 2]} />
      </group>
    </group>
  );
}

/* ===== Helpers pose ===== */
function setRot(g: React.RefObject<THREE.Group>, x: number, y: number, z: number) {
  if (!g.current) return;
  g.current.rotation.set(x, y, z);
}

/* ===== Mapping exercice -> preset ===== */
function choosePreset(a: AIAnalysis): PresetName {
  const s = (a.exercise || a.movement_pattern || "").toLowerCase();
  if (/(pull[\s-]?up|chin[\s-]?up|chest[\s-]?to[\s-]?bar|traction)/.test(s)) return "pullup";
  if (/(push[\s-]?up|pompes?)/.test(s)) return "pushup";
  if (/(overhead|shoulder|militaire|ohp|press)/.test(s)) return "ohp";
  if (/(row|tirage horizontal|seated\s*row)/.test(s)) return "row";
  if (/(hip\s*thrust|extension de hanches)/.test(s)) return "hipthrust";
  if (/(dead[\s-]?lift|soulevé|romanian|rdl|hinge)/.test(s)) return "hinge";
  if (/(lunge|fentes?)/.test(s)) return "lunge";
  if (/(front\s*squat|back\s*squat|squat)/.test(s)) return "squat";
  const mp = (a.movement_pattern || "").toLowerCase();
  if (/hinge|hip/.test(mp)) return "hinge";
  if (/knee|squat/.test(mp)) return "squat";
  return "squat";
}

function label(s: string) {
  const x = (s || "").trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : "";
}
