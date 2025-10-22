import "server-only";
import fs from "fs";
import path from "path";

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
  goal: Goal;
  subGoals: string[];
  level: "debutant" | "intermediaire" | "avance";
  freq: number;
  timePerSession: number;
  equipLevel: EquipLevel;
  equipItems: string[];
  gym: boolean;
  location: "gym" | "home" | "outdoor" | "mixed" | "box";
  injuries: string[];
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
  if (g.includes("mobil") || g.includes("souplesse")) return "mobility"; // <-- fix
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
  const newExos = structuredClone(exercises);

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
  const prenom = safePrenom(answers["prenom"] || (answers as any)["prénom"]);
  const freq = Math.max(1, Math.min(7, parseInt((answers["disponibilite"] || "3").toString()) || 3));
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

  /* Exercices de base */
  const pushFull: NormalizedExercise[] = [
    { name: "Développé couché barre", sets: 4, reps: "6–10", rest: "90s", block: "principal" },
  ];
  const pushLimited: NormalizedExercise[] = [
    { name: "Pompes lestées", sets: 4, reps: "8–12", rest: "90s", block: "principal" },
  ];
  const pushNone: NormalizedExercise[] = [
    { name: "Pompes", sets: 4, reps: "max–2", rest: "90s", block: "principal" },
  ];

  const pullFull: NormalizedExercise[] = [
    { name: "Tractions lestées", sets: 4, reps: "6–10", rest: "90s", block: "principal" },
  ];
  const pullLimited: NormalizedExercise[] = [
    { name: "Rowing haltère", sets: 4, reps: "10–15", rest: "90s", block: "principal" },
  ];
  const pullNone: NormalizedExercise[] = [
    { name: "Superman hold", sets: 3, reps: "30s", rest: "60s", block: "principal" },
  ];

  const legsFull: NormalizedExercise[] = [
    { name: "Back squat", sets: 4, reps: "6–10", rest: "120s", block: "principal" },
  ];
  const legsLimited: NormalizedExercise[] = [
    { name: "Goblet squat", sets: 4, reps: "10–12", rest: "90s", block: "principal" },
  ];
  const legsNone: NormalizedExercise[] = [
    { name: "Air squat", sets: 4, reps: "20", rest: "60s", block: "principal" },
  ];

  const fullBodyFull: NormalizedExercise[] = [
    { name: "Back squat", sets: 3, reps: "6–10", rest: "120s", block: "principal" },
    { name: "Développé couché barre", sets: 3, reps: "6–10", rest: "90s", block: "principal" },
    { name: "Rowing barre", sets: 3, reps: "8–12", rest: "90s", block: "principal" },
  ];

  const fullBodyLimited: NormalizedExercise[] = [
    { name: "Goblet squat", sets: 3, reps: "12", rest: "90s", block: "principal" },
    { name: "Pompes", sets: 3, reps: "max–2", rest: "90s", block: "principal" },
  ];
  const fullBodyNone: NormalizedExercise[] = [
    { name: "Pompes", sets: 3, reps: "max–2", rest: "90s", block: "principal" },
    { name: "Squats", sets: 3, reps: "15–20", rest: "90s", block: "principal" },
  ];

  const cardio: NormalizedExercise[] = [
    { name: "Intervalles 4×4 min Z3", reps: "4×4 min", rest: "2 min", block: "principal" },
  ];
  const hero: NormalizedExercise[] = [
    { name: "Murph modifié", reps: "1 mile run + 100 pompes + 200 squats + 100 tractions + 1 mile run" },
  ];
  const marathon: NormalizedExercise[] = [
    { name: "Course tempo", reps: "30 min", block: "principal" },
  ];
  const mobility: NormalizedExercise[] = [
    { name: "Flow hanches 90/90", reps: "10 min", block: "principal" },
  ];

  const getPush = () => (equipLevel === "full" ? pushFull : equipLevel === "limited" ? pushLimited : pushNone);
  const getPull = () => (equipLevel === "full" ? pullFull : equipLevel === "limited" ? pullLimited : pullNone);
  const getLegs = () => (equipLevel === "full" ? legsFull : equipLevel === "limited" ? legsLimited : legsNone);
  const getFullBody = () =>
    equipLevel === "full" ? fullBodyFull : equipLevel === "limited" ? fullBodyLimited : fullBodyNone;

  const sessions: AiSession[] = [];

  switch (goal) {
    case "hypertrophy":
    case "strength":
      if (freq === 1) sessions.push(makeSession("Full Body", "muscu", getFullBody(), 0));
      else {
        sessions.push(makeSession("Push", "muscu", getPush(), 0));
        if (freq > 1) sessions.push(makeSession("Pull", "muscu", getPull(), 1));
        if (freq > 2) sessions.push(makeSession("Legs", "muscu", getLegs(), 2));
      }
      break;
    case "fatloss":
    case "maintenance":
      for (let i = 0; i < freq; i++) sessions.push(makeSession(`Full Body #${i + 1}`, "muscu", getFullBody(), i));
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
      for (let i = 0; i < freq; i++) sessions.push(makeSession(`Full Body #${i + 1}`, "muscu", getFullBody(), i));
  }

  return {
    sessions,
    profile: {
      email,
      prenom,
      age: undefined,
      goal,
      subGoals: [],
      level: "debutant",
      freq,
      timePerSession,
      equipLevel,
      equipItems: [],
      gym: location === "gym",
      location,
      injuries: [],
    },
  };
}

/* ===================== FS utils ===================== */
const PROGRAMMES_DIR =
  process.env.NODE_ENV === "production"
    ? path.join("/tmp", "programmes")
    : path.join(process.cwd(), "data", "programmes");

function ensureDirSafe(dir = PROGRAMMES_DIR) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function safeFileName(email: string) {
  return email.replace(/[^a-z0-9._-]+/gi, "_").toLowerCase();
}

/* ===================== Sauvegarde / chargement ===================== */
export type SavedProgramme = {
  email: string;
  week: number;
  programme: AiProgramme;
  createdAt: string;
};

export async function saveProgrammeForUser(email: string, programme: AiProgramme, week = 0) {
  try {
    ensureDirSafe();
    const filePath = path.join(PROGRAMMES_DIR, `${safeFileName(email)}.json`);
    const payload: SavedProgramme = { email, week, programme, createdAt: new Date().toISOString() };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    return true;
  } catch (err) {
    console.error("saveProgrammeForUser failed:", err);
    return false;
  }
}

export async function loadProgrammeForUser(email: string): Promise<SavedProgramme | null> {
  try {
    const filePath = path.join(PROGRAMMES_DIR, `${safeFileName(email)}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SavedProgramme;
  } catch (err) {
    console.error("loadProgrammeForUser failed:", err);
    return null;
  }
}

export async function generateNextWeekForUser(email: string, answers: Answers) {
  const saved = await loadProgrammeForUser(email);
  const nextWeek = saved ? saved.week + 1 : 0;
  const newProg = generateProgrammeFromAnswers(answers, nextWeek);
  await saveProgrammeForUser(email, newProg, nextWeek);
  return newProg;
}

/* ===================== Option A – CSV sans en-têtes ===================== */
//  Place ton fichier à: apps/web/data/answers.csv
//  Colonnes (sans en-têtes):
//   0: timestamp (ignoré)
//   1: prénom
//   2: âge
//   3: poids (opt.)
//   4: taille (opt.)
//   5: intensité
//   6: objectif
//   7: disponibilité (ex: 3 / “3 jours” / “lun-mer”)
//   8: matériel (opt.)
//   9: lieu (maison / salle de sport / extérieur / box / mixte)
//  10: email

export async function getAnswersForEmail(email: string): Promise<Record<string, string> | null> {
  try {
    const csvPath = path.join(process.cwd(), "data", "answers.csv");
    if (!fs.existsSync(csvPath)) return null;
    const raw = fs.readFileSync(csvPath, "utf-8");

    const firstNonEmpty = raw.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
    const sep = firstNonEmpty.includes(";") ? ";" : ",";

    function splitCsvLine(line: string, sepChar: string): string[] {
      const out: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (!inQuotes && ch === sepChar) {
          out.push(cur); cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    }

    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const target = email.trim().toLowerCase();

    const KNOWN_LOCATIONS = new Set([
      "maison", "salle de sport", "salle", "exterieur", "extérieur", "outdoor", "box", "mix", "mixte",
    ]);
    const _norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    for (const line of lines) {
      const cols = splitCsvLine(line, sep);
      if (cols.length < 6) continue;

      const last = (cols[cols.length - 1] || "").toLowerCase();
      const emailGuess = /\S+@\S+\.\S+/.test(last)
        ? last
        : (line.match(/\b\S+@\S+\.\S+\b/i)?.[0] || "").toLowerCase();
      if (!emailGuess) continue;
      if (emailGuess !== target) continue;

      let prenom = cols[1] || "";
      let age = cols[2] || "";
      let objectif = cols[6] || "";
      let dispo = cols[7] || "";
      let materiel = cols[8] || "";
      let lieu = cols[9] || "";

      if (cols.length === 10) {
        const c8 = _norm(cols[8] || "");
        if (KNOWN_LOCATIONS.has(c8)) { lieu = cols[8]; materiel = ""; }
        else { materiel = cols[8]; }
      }

      if (!lieu || !KNOWN_LOCATIONS.has(_norm(lieu))) {
        for (const c of cols.slice(0, -1)) {
          const n = _norm(c);
          if (KNOWN_LOCATIONS.has(n)) { lieu = c; break; }
        }
      }

      const out: Record<string, string> = {};
      out["email"] = emailGuess;
      out["prenom"] = prenom;
      if (age && /^\d{1,2}$/.test(age)) out["age"] = age;
      out["objectif"] = objectif;
      out["lieu"] = lieu;
      const dispoNum = parseInt(dispo.replace(/[^0-9]/g, "")) || parseInt(dispo) || 3;
      out["disponibilite"] = String(dispoNum);
      out["as tu du materiel a ta disposition"] = materiel;

      return out;
    }

    return null;
  } catch (err) {
    console.error("getAnswersForEmail (CSV no-headers) failed:", err);
    return null;
  }
}

/* ===================== Profil minimal pour l’UI ===================== */
export function buildProfileFromAnswers(answers: Record<string, string>) {
  return {
    email: answers["email"] || "",
    prenom: answers["prenom"] || (answers as any)["prénom"] || "Coaché",
    age: answers["age"] ? parseInt(answers["age"]) : undefined,
    objectif: answers["objectif"] || "",
    lieu: answers["lieu"] || "",
  };
}

/* ===================== Séances depuis FS ou génération ===================== */
export async function getAiSessions(input: string | AiProgramme) {
  if (typeof input === "string") {
    const saved = await loadProgrammeForUser(input);
    return saved?.programme?.sessions || [];
    }
  return input.sessions || [];
}
