// apps/web/lib/coach/ai.ts
import "server-only";
import { cookies } from "next/headers";

/* ===================== Types partagés ===================== */
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
  note?: string;
  intensity?: "faible" | "modérée" | "élevée";
  recommendedBy?: string;
  exercises?: NormalizedExercise[];
  blocks?: {
    name: "echauffement" | "principal" | "fin" | "accessoires";
    items: NormalizedExercise[];
  }[];
  plan?: any;
  content?: any;
};

export type AiProgramme = { sessions: AiSession[] };

export type Answers = Record<string, string>;
export type Goal =
  | "hypertrophy"
  | "fatloss"
  | "strength"
  | "endurance"
  | "mobility"
  | "general";
export type SubGoal =
  | "glutes"
  | "legs"
  | "chest"
  | "back"
  | "arms"
  | "shoulders"
  | "posture"
  | "core"
  | "rehab";
export type EquipLevel = "full" | "limited" | "none";

export type Profile = {
  email: string;
  prenom?: string;
  age?: number;
  height?: number;
  weight?: number;
  imc?: number;
  goal: Goal;
  subGoals: SubGoal[];
  level: "debutant" | "intermediaire" | "avance";
  freq: number;
  timePerSession: number;
  equipLevel: EquipLevel;
  equipItems: string[];
  gym: boolean;
  location: "gym" | "home" | "outdoor" | "mixed" | "box";
  cardioPref?: "run" | "bike" | "row" | "walk" | "mixed";
  injuries: string[];
  sleepOk?: boolean;
  stressHigh?: boolean;
  likesWOD?: boolean;
};

/* ===================== Config ===================== */
const API_BASE =
  process.env.FILES_COACHING_API_BASE || "https://files-coaching.com";
const API_KEY = process.env.FILES_COACHING_API_KEY || "";
const SHEET_ID = process.env.SHEET_ID || "";
const SHEET_RANGE = process.env.SHEET_RANGE || "Réponses!A1:K";
const SHEET_GID = process.env.SHEET_GID || "";

/* ===================== Utils ===================== */
export function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/ç/g, "c")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readNum(s: string): number | undefined {
  const cleaned = String(s).replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/* ===================== Google Sheets ===================== */
async function fetchValues(sheetId: string, range: string) {
  const sheetName = (range.split("!")[0] || "").replace(/^'+|'+$/g, "");
  if (!sheetId) throw new Error("SHEETS_CONFIG_MISSING");

  const tries: string[] = [];
  if (SHEET_GID) {
    tries.push(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=${encodeURIComponent(
        SHEET_GID
      )}`
    );
  }
  if (sheetName) {
    tries.push(
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        sheetName
      )}`
    );
  }

  for (const url of tries) {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text().catch(() => "");
    if (!res.ok) continue;
    if (text.trim().startsWith("<")) continue;

    const rows: string[][] = [];
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    for (const line of lines) {
      const cells: string[] = [];
      let cur = "",
        inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          cells.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      cells.push(cur);
      rows.push(cells.map((c) => c.trim().replace(/^"|"$/g, "")));
    }
    return { values: rows };
  }
  throw new Error("SHEETS_FETCH_FAILED");
}

// ✅ Mapping sans entête (basé sur ton Excel)
const NO_HEADER_COLS = {
  nom: 1,
  prenom: 1,
  age: 2,
  poids: 3,
  taille: 4,
  niveau: 5,
  objectif: 6,
  disponibilite: 7,
  materiel: 8,
  lieu: 9,
  email: 10,
};

export async function getAnswersForEmail(
  email: string,
  sheetId = SHEET_ID,
  range = SHEET_RANGE
): Promise<Answers | null> {
  const data = await fetchValues(sheetId, range);
  const values: string[][] = data.values || [];
  if (values.length === 0) return null;

  const firstRowNorm = values[0].map(norm);
  const headerCandidates = ["adresse mail", "email", "e-mail", "mail"];
  const hasHeader = firstRowNorm.some((h) => headerCandidates.includes(h));

  let headers: string[] = [];
  let idxEmail = -1;

  if (hasHeader) {
    headers = firstRowNorm;
    idxEmail = headers.findIndex((h) => headerCandidates.includes(h));
  } else {
    const width = Math.max(values[0]?.length || 0, NO_HEADER_COLS.email + 1);
    headers = Array.from({ length: width }, (_, i) => `col${i}`);
    headers[NO_HEADER_COLS.email] = "email";
    idxEmail = NO_HEADER_COLS.email;
  }

  if (idxEmail === -1) return null;

  const start = hasHeader ? 1 : 0;
  for (let i = values.length - 1; i >= start; i--) {
    const row = values[i] || [];
    const cell = (row[idxEmail] || "").trim().toLowerCase();
    if (!cell) continue;
    if (cell === email.trim().toLowerCase()) {
      const rec: Answers = {};
      for (let j = 0; j < row.length; j++) {
        const key = headers[j] || `col${j}`;
        rec[key] = (row[j] ?? "").trim();
      }
      // Champs clés ajoutés pour correspondre à ton Excel
      rec["objectif"] =
        rec["objectif"] || rec[`col${NO_HEADER_COLS.objectif}`] || "";
      rec["niveau"] =
        rec["niveau"] || rec[`col${NO_HEADER_COLS.niveau}`] || "";
      rec["lieu"] = rec["lieu"] || rec[`col${NO_HEADER_COLS.lieu}`] || "";
      rec["as tu du materiel a ta disposition"] =
        rec["as tu du materiel a ta disposition"] ||
        rec[`col${NO_HEADER_COLS.materiel}`] ||
        "";
      rec["disponibilite"] =
        rec["disponibilite"] ||
        rec[`col${NO_HEADER_COLS.disponibilite}`] ||
        "";
      rec["poids"] =
        rec["poids"] || rec[`col${NO_HEADER_COLS.poids}`] || "";
      rec["taille"] =
        rec["taille"] || rec[`col${NO_HEADER_COLS.taille}`] || "";
      rec["email"] =
        rec["email"] || rec[`col${NO_HEADER_COLS.email}`] || "";
      return rec;
    }
  }
  return null;
}

/* ===================== Exports génération & programme ===================== */
export {
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  getProgrammeForUser,
  getAiSessions,
} from "./ai-old";
