// apps/web/lib/coach/beton/index.ts
import type { AiSession as AiSessionT, WorkoutType, NormalizedExercise } from "../ai";

export type PlanOptions = {
  today?: Date;
  maxSessions?: number; // ex: 3 à 5
};

type ProfileInput = {
  prenom?: string;
  age?: number;
  objectif?: string; // libellé brut
  goal?: string;     // clé normalisée: hypertrophy|fatloss|strength|endurance|mobility|general
  equipLevel?: "none" | "limited" | "full";
  timePerSession?: number;
  level?: "debutant" | "intermediaire" | "avance";
};

export function planProgrammeFromProfile(
  profile: ProfileInput,
  opts: PlanOptions = {}
): { sessions: AiSessionT[] } {
  const today = opts.today ?? new Date();
  const maxSessions = Math.max(1, Math.min(opts.maxSessions ?? 3, 6));
  const time = clamp(profile.timePerSession ?? defaultTime(profile.goal), 20, 90);
  const type = pickType(profile.goal, profile.age);
  const level = profile.level ?? inferLevel(profile.age);
  const equip = profile.equipLevel ?? "limited";
  const goalKey = (profile.goal ?? "general").toLowerCase();

  const sessions: AiSessionT[] = [];
  for (let i = 0; i < maxSessions; i++) {
    const d = addDays(today, i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    const variant = i % 3; // A/B/C
    const labelABC = ["A", "B", "C"][variant];

    const title = profile.prenom
      ? `Séances pour ${profile.prenom} — ${labelABC}`
      : defaultTitle(type, i);

    const exos =
      type === "cardio"
        ? buildCardioBlockset(time, variant)
        : type === "mobilité"
        ? buildMobilityBlockset()
        : type === "hiit"
        ? buildHiitBlockset()
        : buildStrengthBlockset({ level, equip, minutes: time, variantIdx: variant, goal: goalKey });

    sessions.push({
      id: `beton-${dateStr}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      type,
      date: dateStr,
      plannedMin: time,
      intensity: type === "hiit" ? "élevée" : type === "cardio" ? "modérée" : "modérée",
      exercises: exos,
    } as AiSessionT);
  }

  return { sessions };
}

/* ---------------- Internals “coach” ---------------- */
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function defaultTime(goal?: string) {
  switch ((goal ?? "").toLowerCase()) {
    case "endurance": return 35;
    case "mobility": return 25;
    case "fatloss": return 35;
    default: return 45;
  }
}

function pickType(goal?: string, age?: number): WorkoutType {
  const g = (goal ?? "").toLowerCase();
  if (g === "endurance") return "cardio";
  if (g === "mobility") return "mobilité";
  if (g === "fatloss" && (age ?? 0) > 45) return "hiit";
  return "muscu";
}

function inferLevel(age?: number): "debutant" | "intermediaire" | "avance" {
  if (!age) return "intermediaire";
  if (age < 25) return "intermediaire";
  if (age > 50) return "debutant";
  return "intermediaire";
}

function defaultTitle(t: WorkoutType, i: number) {
  const base = t === "cardio" ? "Cardio" : t === "mobilité" ? "Mobilité" : t === "hiit" ? "HIIT" : "Muscu";
  const abc = ["A", "B", "C"][i % 3];
  return `${base} — ${abc}`;
}

/* ----------------- Cardio / Mobilité / HIIT ----------------- */
function buildCardioBlockset(minutes: number, variantIdx: number): NormalizedExercise[] {
  // alterne continu vs fractionné
  if (variantIdx % 2 === 0) {
    return [
      { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
      { name: "Z2 continu", reps: `${Math.max(15, minutes - 12)} min`, block: "principal" },
      { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" },
    ];
  }
  return [
    { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
    { name: "Fractionné Z2/Z3", reps: "12×(1’/1’)", block: "principal" },
    { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" },
  ];
}

function buildMobilityBlockset(): NormalizedExercise[] {
  return [
    { name: "Respiration diaphragmatique", reps: "2–3 min", block: "echauffement" },
    { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
    { name: "T-spine rotations", reps: "8–10/ côté", block: "principal" },
    { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
  ];
}

function buildHiitBlockset(): NormalizedExercise[] {
  return [
    { name: "Air Squats", reps: "40s", rest: "20s", block: "principal" },
    { name: "Mountain Climbers", reps: "40s", rest: "20s", block: "principal" },
    { name: "Burpees", reps: "30–40s", rest: "30–40s", block: "principal" },
  ];
}

/* ----------------- Musculation (variantes A/B/C) ----------------- */
function buildStrengthBlockset(params: {
  level: "debutant" | "intermediaire" | "avance";
  equip: "none" | "limited" | "full";
  minutes: number;
  variantIdx: number; // 0=A, 1=B, 2=C
  goal: string;
}): NormalizedExercise[] {
  const { level, equip, variantIdx, goal } = params;
  const out: NormalizedExercise[] = [];

  // Échauffement rapide
  out.push({ name: "Mobilité dynamique (hanches/épaules)", reps: "3–5 min", block: "echauffement" });

  const add = (ex: NormalizedExercise) => out.push(ex);

  if (equip === "full") {
    if (variantIdx === 0) {
      // A — Jambes + Poussée
      add(barbell("Back Squat", level, goal));
      add(barbell("Bench Press", level, goal));
      add(barbell("Row à la barre", level, goal));
    } else if (variantIdx === 1) {
      // B — Soulevé + Tirage vertical + Poussée verticale
      add(barbell("Soulevé de terre (technique)", level, goal));
      add(machineOrCable("Tirage vertical", level, goal));
      add(barbell("Développé militaire", level, goal));
    } else {
      // C — Front squat + Haltères + Tractions/Row
      add(barbell("Front Squat", level, goal));
      add(dumbbell("Développé haltères incliné", level, goal));
      add(bodyOrCable("Tractions assistées / Tirage poulie", level, goal));
    }
  } else if (equip === "limited") {
    if (variantIdx === 0) {
      add(dumbbell("Goblet Squat", level, goal));
      add(dumbbell("Développé haltères", level, goal));
      add(dumbbell("Rowing unilatéral", level, goal, "10–12/ côté"));
    } else if (variantIdx === 1) {
      add(dumbbell("Fente arrière", level, goal, "8–12/ côté"));
      add(dumbbell("Élévations latérales", level, goal, "12–15"));
      add(dumbbell("Rowing buste penché", level, goal));
    } else {
      add(dumbbell("Hip Thrust (haltère)", level, goal));
      add(dumbbell("Pompes surélevées", level, goal, pickBodyweight(goal)));
      add(dumbbell("Curl + Extension triceps", level, goal, "10–12"));
    }
  } else {
    // equip === "none" — poids du corps
    if (variantIdx === 0) {
      add(body("Squat", level, goal));
      add(body("Pompes", level, goal));
      add(body("Row table / tirage élastique", level, goal));
    } else if (variantIdx === 1) {
      add(body("Fente arrière", level, goal, "10–15/ côté"));
      add(body("Pompes diamant / genoux", level, goal, pickBodyweight(goal)));
      add(body("Superman hold", level, goal, "20–30s"));
    } else {
      add(body("Squat sauté (technique)", level, goal, "8–10"));
      add(body("Dips banc / chaise", level, goal, pickBodyweight(goal)));
      add(body("Tirage élastique / serviette", level, goal, pickBodyweight(goal)));
    }
  }

  // Accessoires / tronc
  out.push({ name: "Gainage planche", sets: 2, reps: "30–45s", rest: "45s", block: "fin" });

  return out;
}

/* ---- Helpers exos ---- */
function setsFor(level: "debutant" | "intermediaire" | "avance", bw = false) {
  if (bw) return level === "avance" ? 4 : 3;
  return level === "avance" ? 4 : level === "intermediaire" ? 3 : 2;
}
function rirFor(level: "debutant" | "intermediaire" | "avance") {
  return level === "avance" ? 1 : 2;
}
function tempoFor(goal: string) {
  const g = goal.toLowerCase();
  if (g === "hypertrophy") return "3011";
  if (g === "strength") return "21X1";
  return "2011";
}
function repsFor(goal: string) {
  const g = goal.toLowerCase();
  if (g === "strength") return "4–6";
  if (g === "hypertrophy") return "8–12";
  if (g === "fatloss") return "10–15";
  if (g === "endurance") return "12–15";
  if (g === "mobility") return "8–10";
  return "8–12";
}
function pickBodyweight(goal: string) {
  const g = goal.toLowerCase();
  if (g === "strength") return "6–8";
  if (g === "fatloss") return "12–20";
  return "10–15";
}

function barbell(name: string, level: any, goal: string, reps?: string): NormalizedExercise {
  return { name, sets: setsFor(level), reps: reps || repsFor(goal), rest: "90s", tempo: tempoFor(goal), rir: rirFor(level), block: "principal", equipment: "barre" };
}
function dumbbell(name: string, level: any, goal: string, reps?: string): NormalizedExercise {
  return { name, sets: setsFor(level), reps: reps || repsFor(goal), rest: "75s", tempo: tempoFor(goal), rir: rirFor(level), block: "principal", equipment: "haltères" };
}
function machineOrCable(name: string, level: any, goal: string, reps?: string): NormalizedExercise {
  return { name, sets: setsFor(level), reps: reps || repsFor(goal), rest: "75–90s", tempo: tempoFor(goal), rir: rirFor(level), block: "principal", equipment: "machine/câble" };
}
function bodyOrCable(name: string, level: any, goal: string, reps?: string): NormalizedExercise {
  return { name, sets: setsFor(level, true), reps: reps || pickBodyweight(goal), rest: "60–75s", block: "principal", equipment: "poids du corps / câble" };
}
function body(name: string, level: any, goal: string, reps?: string): NormalizedExercise {
  return { name, sets: setsFor(level, true), reps: reps || pickBodyweight(goal), rest: "60s", block: "principal", equipment: "poids du corps" };
}
