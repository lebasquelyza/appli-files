// apps/web/lib/coach/ai.ts
import "server-only";

/* ===================== Types ===================== */
export type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

export type NormalizedExercise = {
  name: string;
  sets?: number;
  reps?: string | number;
  rest?: string;
  durationSec?: number;
  notes?: string;
  tempo?: string;
  rir?: number;
  load?: string;
  equipment?: string;
  target?: string;
  alt?: string;
  videoUrl?: string;
  block?: "echauffement" | "principal" | "fin" | "accessoires";
};

export type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string;
  plannedMin?: number;
  intensity?: "faible" | "modérée" | "élevée";
  exercises?: NormalizedExercise[];
};

export type Answers = Record<string, string>;
export type Goal =
  | "hypertrophy"
  | "fatloss"
  | "maintenance"
  | "strength"
  | "endurance"
  | "mobility"
  | "hero"
  | "marathon"
  | "general";

export type EquipLevel = "full" | "limited" | "none";

export type Profile = {
  email: string;
  prenom?: string;
  age?: number;
  objectif?: string;
  lieu?: string;
  goal?: Goal;
  subGoals?: string[];
  level?: "debutant" | "intermediaire" | "avance";
  freq?: number;
  timePerSession?: number;
  equipLevel: EquipLevel;
  equipItems?: string[];
  gym?: boolean;
  location?: "gym" | "home" | "outdoor" | "mixed" | "box";
  injuries?: string[];
};

export type AiProgramme = {
  sessions: AiSession[];
  profile?: Profile;
};

/* ===================== Helpers ===================== */
function norm(s: string) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function safePrenom(str?: string) {
  return str?.trim() ? str : "Coaché";
}
function mapGoal(s?: string): Goal {
  const g = norm(s || "");
  if (g.includes("force")) return "strength";
  if (g.includes("hypert")) return "hypertrophy";
  if (g.includes("pdm")) return "hypertrophy";
  if (g.includes("perte") || g.includes("gras") || g.includes("minceur")) return "fatloss";
  if (g.includes("maintien") || g.includes("forme")) return "maintenance";
  if (g.includes("hero")) return "hero";
  if (g.includes("marathon") || g.includes("semi")) return "marathon";
  if (g.includes("cardio") || g.includes("endurance")) return "endurance";
  if (g.includes("mobil") || g.includes("souplesse")) return "mobility";
  return "general";
}

/* ===================== Durée/intensité auto ===================== */
function computeSessionParams(goal: Goal, freq: number) {
  let timePerSession = 45;
  let intensity: "faible" | "modérée" | "élevée" = "modérée";

  if (goal === "fatloss") {
    timePerSession = freq <= 2 ? 35 : 50;
    intensity = freq <= 2 ? "élevée" : "modérée";
  } else if (goal === "hypertrophy" || goal === "strength") {
    timePerSession = freq <= 2 ? 45 : 65;
    intensity = "élevée";
  } else if (goal === "maintenance") {
    timePerSession = freq <= 2 ? 35 : 50;
    intensity = "modérée";
  } else if (goal === "endurance" || goal === "marathon") {
    timePerSession = freq <= 2 ? 40 : 60;
    intensity = "modérée";
  } else if (goal === "mobility") {
    timePerSession = 30;
    intensity = "faible";
  } else if (goal === "hero") {
    timePerSession = 60;
    intensity = "élevée";
  }

  return { timePerSession, intensity };
}

/* ===================== Progression ===================== */
function applyProgression(
  exercises: NormalizedExercise[],
  goal: Goal,
  week: number
): NormalizedExercise[] {
  const newExos = JSON.parse(JSON.stringify(exercises)) as NormalizedExercise[];

  for (const ex of newExos) {
    if (goal === "hypertrophy" || goal === "strength") {
      if (typeof ex.sets === "number") ex.sets += Math.floor(week / 2);
      if (typeof ex.reps === "string" && /\d+/.test(ex.reps)) {
        const base = parseInt(ex.reps.match(/\d+/)![0]);
        ex.reps = `${base + week}-12`;
      }
    }
    if (goal === "fatloss" || goal === "endurance" || goal === "marathon") {
      if (typeof ex.reps === "string" && ex.reps.includes("min")) {
        const add = Math.min(week * 2, 15);
        ex.reps = ex.reps.replace(/\d+/, (m) => String(parseInt(m) + add));
      }
    }
    if (goal === "mobility") {
      if (typeof ex.reps === "string" && ex.reps.includes("min")) {
        const add = Math.min(week, 5);
        ex.reps = ex.reps.replace(/\d+/, (m) => String(parseInt(m) + add));
      }
    }
    if (goal === "hero") {
      if (typeof ex.reps === "string" && ex.reps.includes("mile")) {
        const add = Math.min(week * 0.5, 2);
        ex.reps = ex.reps.replace(/\d+/, (m) => String(parseFloat(m) + add));
      }
    }
  }

  return newExos;
}

/* ===================== Génération IA ===================== */
export function generateProgrammeFromAnswers(answers: Answers, week = 0): AiProgramme {
  const today = new Date();
  const email = (answers["email"] || "").trim().toLowerCase();
  const goal = mapGoal(answers["objectif"]);
  const prenom = safePrenom(answers["prenom"] || answers["prénom"]);
  const freq = Math.max(1, Math.min(7, parseInt(answers["disponibilite"] || "3") || 3));
  const { timePerSession, intensity } = computeSessionParams(goal, freq);

  // 📍 lieu → équipement
  const locStr = norm(answers["lieu"] || "");
  let location: Profile["location"] = "gym";
  if (locStr.includes("maison")) location = "home";
  else if (locStr.includes("exter")) location = "outdoor";
  else if (locStr.includes("box")) location = "box";
  else if (locStr.includes("mix")) location = "mixed";

  let inferredEquip: EquipLevel = "full";
  if (location === "home") inferredEquip = "limited";
  if (location === "outdoor") inferredEquip = "none";

  const eq = norm(answers["as tu du materiel a ta disposition"] || "");
  let equipLevel: EquipLevel = inferredEquip;
  if (eq.includes("rack") || eq.includes("barre") || eq.includes("machine")) equipLevel = "full";
  else if (eq.includes("halter") || eq.includes("elasti") || eq.includes("kettle")) equipLevel = "limited";
  else if (eq.includes("aucun") || eq.includes("rien")) equipLevel = "none";

  const injuries = answers["blessures"]
    ? answers["blessures"].split(",").map((s) => s.trim())
    : [];

  const makeSession = (title: string, type: WorkoutType, exos: NormalizedExercise[], offset = 0): AiSession => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return {
      id: `${email}-${d.toISOString().slice(0, 10)}-${title}`,
      title,
      type,
      date: d.toISOString().slice(0, 10),
      plannedMin: timePerSession,
      intensity,
      exercises: applyProgression(exos, goal, week),
    };
  };

  // Exercices de base (fallback universel)
  const fullBodyNone = [
    { name: "Pompes", sets: 3, reps: "max–2", rest: "90s" },
    { name: "Squats", sets: 3, reps: "15–20", rest: "90s" },
  ];
  const cardio = [{ name: "Intervalles 4×4 min Z3", reps: "4×4 min", rest: "2 min" }];
  const hero = [{ name: "Murph modifié", reps: "1 mile run + 100 pompes + 200 squats + 100 tractions + 1 mile run" }];
  const marathon = [{ name: "Course tempo", reps: "30 min" }];
  const mobility = [{ name: "Flow hanches 90/90", reps: "10 min" }];

  const sessions: AiSession[] = [];

  switch (goal) {
    case "hypertrophy":
    case "strength":
      sessions.push(makeSession("Full Body", "muscu", fullBodyNone, 0));
      break;
    case "fatloss":
    case "maintenance":
      for (let i = 0; i < freq; i++) sessions.push(makeSession(`Full Body #${i + 1}`, "muscu", fullBodyNone, i));
      break;
    case "endurance":
      for (let i = 0; i < freq; i++) sessions.push(makeSession(`Cardio #${i + 1}`, "cardio", cardio, i));
      break;
    case "marathon":
      for (let i = 0; i < freq; i++) sessions.push(makeSession(`Course ${i + 1}`, "cardio", marathon, i));
      break;
    case "hero":
      for (let i = 0; i < freq; i++) sessions.push(makeSession(`Hero WOD #${i + 1}`, "hiit", hero, i));
      break;
    case "mobility":
      for (let i = 0; i < freq; i++) sessions.push(makeSession(`Mobilité #${i + 1}`, "mobilité", mobility, i));
      break;
    default:
      for (let i = 0; i < freq; i++) sessions.push(makeSession(`Full Body #${i + 1}`, "muscu", fullBodyNone, i));
  }

  return {
    sessions,
    profile: {
      email,
      prenom,
      objectif: answers["objectif"],
      goal,
      subGoals: [],
      level: "debutant",
      freq,
      timePerSession,
      equipLevel,
      equipItems: [],
      gym: location === "gym",
      location,
      injuries,
    },
  };
}

/* ===================== Accès fichier (optionnel, edge-safe) ===================== */
function getFS() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path") as typeof import("path");
    return { fs, path };
  } catch {
    return null; // Edge runtime : pas de fs
  }
}
function programmesDir() {
  const mod = getFS();
  if (!mod) return null;
  const { fs, path } = mod;
  const dir = path.join(process.cwd(), "data", "programmes");
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

/* ===================== Sauvegarde / chargement (no-op si edge) ===================== */
export type SavedProgramme = {
  email: string;
  week: number;
  programme: AiProgramme;
  createdAt: string;
};

export async function saveProgrammeForUser(email: string, programme: AiProgramme, week = 0) {
  const mod = getFS();
  const dir = programmesDir();
  if (!mod || !dir) return true; // no-op en edge
  const { fs, path } = mod;
  const filePath = path.join(dir, `${email}.json`);
  const payload: SavedProgramme = { email, week, programme, createdAt: new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return true;
}

export async function loadProgrammeForUser(email: string): Promise<SavedProgramme | null> {
  const mod = getFS();
  const dir = programmesDir();
  if (!mod || !dir) return null; // pas de persistence en edge
  const { fs, path } = mod;
  const filePath = path.join(dir, `${email}.json`);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SavedProgramme;
  } catch {
    return null;
  }
}

/* ===================== Legacy: réponses (mock) ===================== */
export async function getAnswersForEmail(email: string): Promise<Record<string, string> | null> {
  // ⚠️ à adapter à ta source réelle (Sheets / API). Ici : mock optionnel.
  const mod = getFS();
  if (!mod) return null; // edge : pas de mock fichier
  const { fs, path } = mod;
  const filePath = path.join(process.cwd(), "data", "mock-answers.json");
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return data[email] || null;
  } catch {
    return null;
  }
}

/* ===================== Profile Builder (compatible pages) ===================== */
export function buildProfileFromAnswers(answers: Record<string, string>) {
  const locationRaw = (answers["lieu"] || "").toLowerCase();
  let equipLevel: EquipLevel = "full";
  let equipItems: string[] = [];

  if (locationRaw.includes("dehors") || locationRaw.includes("extérieur")) {
    equipLevel = "none";
  } else if (locationRaw.includes("maison") || locationRaw.includes("appartement")) {
    equipLevel = "limited";
    equipItems = ["haltères légers", "élastiques"];
  } else if (locationRaw.includes("salle")) {
    equipLevel = "full";
    equipItems = ["machines", "barres", "haltères"];
  }

  const freq = Math.max(1, Math.min(7, parseInt(answers["disponibilite"] || "3") || 3));
  const goal = mapGoal(answers["objectif"]);
  const { timePerSession } = computeSessionParams(goal, freq);

  return {
    email: answers["email"] || "",
    prenom: answers["prenom"] || answers["prénom"] || "Coaché",
    age: answers["age"] ? parseInt(answers["age"]) : undefined,
    objectif: answers["objectif"] || "",
    lieu: answers["lieu"] || "",
    equipLevel,
    equipItems,
    timePerSession,
    injuries: answers["blessures"]
      ? answers["blessures"].split(",").map((s) => s.trim())
      : [],
  };
}

/* ===================== getAiSessions + Next Week (sécurisé) ===================== */
export async function getAiSessions(input?: string | AiProgramme) {
  try {
    if (!input) {
      const email = process.env.DEFAULT_TEST_EMAIL || "test@example.com";
      const saved = await loadProgrammeForUser(email);
      return saved?.programme?.sessions || [];
    }
    if (typeof input === "string") {
      if (!input || !input.includes("@")) return [];
      const saved = await loadProgrammeForUser(input);
      return saved?.programme?.sessions || [];
    }
    if (input && Array.isArray(input.sessions)) {
      return input.sessions;
    }
    return [];
  } catch (err) {
    console.error("[getAiSessions] ERREUR :", err);
    return [];
  }
}

export async function generateNextWeekForUser(email: string, answers: Answers) {
  try {
    const saved = await loadProgrammeForUser(email);
    const nextWeek = saved ? saved.week + 1 : 0;
    const newProg = generateProgrammeFromAnswers(answers, nextWeek);
    await saveProgrammeForUser(email, newProg, nextWeek);
    return newProg;
  } catch (err) {
    console.error("[generateNextWeekForUser] ERREUR :", err);
    return null;
  }
}
