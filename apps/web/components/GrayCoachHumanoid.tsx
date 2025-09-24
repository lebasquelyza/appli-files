"use client";

import React, { useEffect, useRef } from "react";
let THREE: typeof import("three") | null = null;

type AIAnalysis = { exercise: string; movement_pattern?: string };

export default function GrayCoachHumanoid({
  analysis,
  exerciseOverride,
  height = 420,
  modelUrl = "/models/humanoid.glb",
}: {
  analysis: AIAnalysis;
  exerciseOverride?: string;
  height?: number;
  modelUrl?: string; // GLB avec animations
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;
    let mixer: import("three").AnimationMixer | null = null;
    let clock: import("three").Clock | null = null;
    let model: import("three").Object3D | null = null;

    (async () => {
      if (!THREE) THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

      if (!mounted || !THREE) return;

      const container = containerRef.current!;
      const canvas = canvasRef.current!;

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.setClearColor(0x0b0b0b, 1);

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(1.4, 1.7, 4.4);
      camera.lookAt(0, 1.2, 0);
      scene.add(camera);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const d = new THREE.DirectionalLight(0xffffff, 1);
      d.position.set(3, 5, 3);
      scene.add(d);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      const onResize = () => {
        if (!renderer || !camera || !container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (w < 420) camera.position.set(1.6, 1.8, 5.2);
        else camera.position.set(1.4, 1.7, 4.4);
      };
      onResize();
      window.addEventListener("resize", onResize);

      // === Load humanoid + animations ===
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(modelUrl);
      model = gltf.scene;
      model.traverse((o: any) => { o.castShadow = false; o.receiveShadow = false; });
      scene.add(model);

      mixer = new THREE.AnimationMixer(model);
      clock = new THREE.Clock();

      const clips = gltf.animations || [];
      const byName = new Map<string, import("three").AnimationClip>();
      for (const c of clips) byName.set(c.name.toLowerCase(), c);

      // pick exercise
      const exoKey = normalizeExercise(exerciseOverride || analysis.exercise || analysis.movement_pattern || "");
      const wanted = chooseClip(exoKey, byName);

      if (wanted) {
        const action = mixer.clipAction(wanted);
        action.reset().fadeIn(0.2).play();
      } else {
        // fallback: si pas de clip, on ne fait rien (reste idle si présent)
        const idle = byName.get("idle") || byName.get("tpose") || byName.get("idle_loop");
        if (idle) mixer.clipAction(idle).play();
      }

      const animate = () => {
        const dt = clock!.getDelta();
        mixer?.update(dt);
        renderer!.render(scene!, camera!);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);

      return () => {
        window.removeEventListener("resize", onResize);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        mixer?.stopAllAction();
        renderer?.dispose();
        scene?.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose?.();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose?.());
            else obj.material.dispose?.();
          }
        });
      };
    })();

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analysis, exerciseOverride]);

  return (
    <div ref={containerRef} className="w-full border rounded-2xl overflow-hidden relative" style={{ height }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2 left-2 rounded bg-black/60 text-white text-[11px] px-2 py-1">
        Humanoïde (GLTF + animations)
      </div>
    </div>
  );
}

function normalizeExercise(raw: string) {
  const s = (raw || "").toLowerCase();
  if (/(pull-?up|traction)/.test(s)) return "pullup";
  if (/(bulgarian|fente\s*bulg)/.test(s)) return "bulgarian";
  if (/(squat|goblet|front\s*squat)/.test(s)) return "squat";
  if (/(deadlift|soulev|hinge|rdl|hip)/.test(s)) return "deadlift";
  if (/(lunge|fente)/.test(s)) return "lunge";
  if (/(push-?up|pompe)/.test(s)) return "pushup";
  if (/(overhead|ohp|militaire|shoulder\s*press)/.test(s)) return "ohp";
  // Ajoute ici: row, hip thrust, bench press, dips, etc.
  return s.split(" ")[0]; // default: 1er mot
}

function chooseClip(
  key: string,
  byName: Map<string, import("three").AnimationClip>
): import("three").AnimationClip | undefined {
  // mapping souple (synonymes)
  const aliases: Record<string, string[]> = {
    squat: ["squat", "back_squat", "front_squat", "goblet_squat"],
    deadlift: ["deadlift", "rdl", "hinge"],
    lunge: ["lunge", "forward_lunge", "reverse_lunge"],
    bulgarian: ["bulgarian", "bulgarian_split_squat", "fente_bulgare"],
    pushup: ["pushup", "push_up", "pompe"],
    pullup: ["pullup", "pull_up", "traction"],
    ohp: ["ohp", "overhead_press", "shoulder_press", "militaire"],
  };
  const list = aliases[key] || [key];
  for (const name of list) {
    const c = byName.get(name.toLowerCase());
    if (c) return c;
  }
  // essai direct si l’analyse renvoie le nom exact
  return byName.get(key.toLowerCase());
}
