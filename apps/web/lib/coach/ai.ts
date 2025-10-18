// apps/web/lib/coach/ai.ts
import { v4 as uuidv4 } from "uuid";

/* ============================================================
   Types
============================================================ */
export type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

export type NormalizedExercise = {
  name: string;
  sets?: number;
  reps?: string;
  rest?: string;
  block?: string;
  equipment?: string;
  target?: string;
  notes?: string;
  tempo?: string;
  durationSec?: number;
  load?: string;
  rir?: number;
  videoUrl?: string;
  alt?: string;
};

export type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string;
  plannedMin?: number;
  intensity?: string;
  exercises?: NormalizedExercise[];
};

export type Profile = {
  prenom?: string;
  email?: string;
  age?: number;
  weight?: number;
  height?: number;
  goal?: string;
  freq?: number;
  equipLevel?: string;
  equipItems?: string[];
  injuries?: string[];
  timePerSession?: number;
};

export type AiProgramme = {
  sessions: AiSession[];
  profile?: Profile;
};

/* ============================================================
   Utilitaires
============================================================ */
function parseNumber(x: any): number | null {
  const n = Number(String(x).replace(",", "."));
  return isFinite(n) && !isNaN(n) ? n : null;
}

function normalizeWorkoutType(input?: string): WorkoutType {
  const s = String(input || "").toLowerCase();
  if (["cardio", "endurance"].includes(s)) return "cardio";
  if (["hiit", "metcon", "wod"].includes(s)) return "hiit";
  if (["mobilite", "mobilité"].includes(s)) return "mobilité";
  return "muscu";
}

/* ============================================================
   Extraction du profil depuis la feuille
============================================================ */
export function buildProfileFromAnswers(answers: Record<string, string>): Profile {
  const prenom = answers["prenom"] || answers["Prénom"] || "";
  const email = answers["email"] || answers["Email"] || "";

  const age = parseNumber(answers["age"]) || parseNumber(answers["Âge"]);
  const weight = parseNumber(answers["poids"]) || parseNumber(answers["Poids"]);
  const height = parseNumber(answers["taille"]) || parseNumber(answers["Taille"]);

  // ✅ Clamp fréquence à min 1 séance
  const freqRaw = parseNumber(answers["disponibilite"] || answers["fréquence"]) ?? 3;
  const freq = Math.max(1, Math.min(7, Math.floor(freqRaw)));

  const goal = answers["objectif"] || answers["Objectif"] || "";

  const equipRaw = (answers["equipement"] || answers["Équipement"] || "").toLowerCase();
  let equipLevel = "none";
  let equipItems: string[] = [];
  if (equipRaw.includes("halt")) {
    equipLevel = "limited";
    equipItems.push("haltères");
  }
  if (equipRaw.includes("barre") || equipRaw.includes("machine")) {
    equipLevel = "full";
  }

  const injuries = (answers["blessures"] || answers["Blessures"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const timePerSession = parseNumber(answers["duree"]) || 45;

  return {
    prenom,
    email,
    age: age || undefined,
    weight: weight || undefined,
    height: height || undefined,
    goal,
    freq,
    equipLevel,
    equipItems,
    injuries,
    timePerSession,
  };
}

/* ============================================================
   Génération de programme basique depuis profil
============================================================ */
export function generateProgrammeFromAnswers(answers: Record<string, string>): AiProgramme {
  const p = buildProfileFromAnswers(answers);
  const count = Math.max(1, Math.min(7, Math.floor(p.freq || 3))); // ✅ min 1

  const sessions: AiSession[] = Array.from({ length: count }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);

    return {
      id: uuidv4(),
      title: `Séance ${i + 1}`,
      type: "muscu",
      date,
      plannedMin: p.timePerSession || 45,
      intensity: "modérée",
      exercises: [
        { name: "Squat goblet", sets: 3, reps: "10–12", rest: "60–90s", block: "principal" },
        { name: "Rowing haltère", sets: 3, reps: "8–10", rest: "60–90s", block: "principal" },
        { name: "Pompes", sets: 3, reps: "max–2", rest: "60s", block: "principal" },
      ],
    };
  });

  return { sessions, profile: p };
}

/* ============================================================
   Récupération de réponses et fallback IA
============================================================ */
// 👉 ici tu mets ta vraie logique pour récupérer les réponses Sheets
export async function getAnswersForEmail(email: string): Promise<Record<string, string> | null> {
  if (!email) return null;
  // À adapter selon ta stack Google Sheets
  return null;
}

// 👉 fallback si tu as une autre source IA
export async function getAiSessions(email: string): Promise<AiSession[]> {
  return [];
}

export { normalizeWorkoutType };
