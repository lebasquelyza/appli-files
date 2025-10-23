// Point d’entrée "béton" — pas d'import runtime depuis ai.ts pour éviter les cycles.
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

  const sessions: AiSessionT[] = [];
  for (let i = 0; i < maxSessions; i++) {
    const d = addDays(today, i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    const title = profile.prenom
      ? `Séances pour ${profile.prenom}`
      : defaultTitle(type, i);

    const exos = buildBlockset({
      type,
      level: profile.level ?? inferLevel(profile.age),
      equip: profile.equipLevel ?? "limited",
      minutes: time,
      variantIdx: i,
      goal: profile.goal ?? "general",
    });

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
  return `${base} #${i + 1}`;
}

function buildBlockset(params: {
  type: WorkoutType;
  level: "debutant" | "intermediaire" | "avance";
  equip: "none" | "limited" | "full";
  minutes: number;
  variantIdx: number;
  goal: string;
}): NormalizedExercise[] {
  const { type, level, equip, minutes, variantIdx, goal } = params;

  if (type === "cardio") {
    return [
      { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
      { name: variantIdx % 2 ? "Z2 continu" : "Fractionné Z2/Z3", reps: variantIdx % 2 ? `${minutes - 15} min` : "12×(1’/1’)", block: "principal" },
      { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" },
    ];
  }

  if (type === "mobilité") {
    return [
      { name: "Respiration diaphragmatique", reps: "2–3 min", block: "echauffement" },
      { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
      { name: "T-spine rotations", reps: "8–10/ côté", block: "principal" },
      { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
    ];
  }

  if (type === "hiit") {
    return [
      { name: "Air Squats", reps: "40s", rest: "20s", block: "principal" },
      { name: "Mountain Climbers", reps: "40s", rest: "20s", block: "principal" },
      { name: "Burpees", reps: "30–40s", rest: "30–40s", block: "principal" },
    ];
  }

  // type === "muscu"
  const base: NormalizedExercise[] = [];

  // Échauffement rapide
  base.push({ name: "Mobilité dynamique (hanches/épaules)", reps: "3–5 min", block: "echauffement" });

  // Bloc principal en fonction du matériel
  if (equip === "full") {
    base.push({ name: "Back Squat", sets: pickSets(level), reps: pickReps(goal, "bas"), rest: "90s", tempo: pickTempo(goal), rir: pickRIR(level), block: "principal", equipment: "barre" });
    base.push({ name: "Bench Press", sets: pickSets(level), reps: pickReps(goal, "haut"), rest: "90s", tempo: pickTempo(goal), rir: pickRIR(level), block: "principal", equipment: "barre" });
    base.push({ name: "Row à la barre", sets: pickSets(level), reps: pickReps(goal, "dos"), rest: "90s", tempo: pickTempo(goal), rir: pickRIR(level), block: "principal", equipment: "barre" });
  } else if (equip === "limited") {
    base.push({ name: "Goblet Squat", sets: pickSets(level), reps: pickReps(goal, "bas"), rest: "75s", tempo: pickTempo(goal), rir: pickRIR(level), block: "principal", equipment: "haltères" });
    base.push({ name: "Développé haltères", sets: pickSets(level), reps: pickReps(goal, "haut"), rest: "75s", tempo: pickTempo(goal), rir: pickRIR(level), block: "principal", equipment: "haltères" });
    base.push({ name: "Rowing unilatéral", sets: pickSets(level), reps: "10–12/ côté", rest: "75s", tempo: pickTempo(goal), rir: pickRIR(level), block: "principal", equipment: "haltères" });
  } else {
    base.push({ name: "Squat au poids du corps", sets: pickSets(level, true), reps: pickBodyweight(goal), rest: "60s", block: "principal", equipment: "poids du corps" });
    base.push({ name: "Pompes", sets: pickSets(level, true), reps: pickBodyweight(goal), rest: "60s", block: "principal", equipment: "poids du corps" });
    base.push({ name: "Row table / tirage élastique", sets: pickSets(level, true), reps: pickBodyweight(goal), rest: "60s", block: "principal", equipment: "poids du corps" });
  }

  // Accessoires
  base.push({ name: "Gainage planche", sets: 2, reps: "30–45s", rest: "45s", block: "fin" });

  return base;
}

/* ---- Petites règles coach ---- */
function pickSets(level: "debutant" | "intermediaire" | "avance", bw = false) {
  if (bw) return level === "avance" ? 4 : 3;
  return level === "avance" ? 4 : level === "intermediaire" ? 3 : 2;
}
function pickRIR(level: "debutant" | "intermediaire" | "avance") {
  return level === "avance" ? 1 : 2;
}
function pickTempo(goal: string) {
  const g = goal.toLowerCase();
  if (g === "hypertrophy") return "3011";
  if (g === "strength") return "21X1";
  return "2011";
}
function pickReps(goal: string, area: "bas" | "haut" | "dos") {
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
