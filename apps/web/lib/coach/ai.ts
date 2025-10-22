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

/** Profil minimal (pas de DB) */
export type UserProfile = {
  id: string;
  email: string;
  prenom?: string | null;
};

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

/* ===================== Config (Google Sheets) ===================== */
const SHEET_ID = process.env.SHEET_ID || "";
const SHEET_RANGE = process.env.SHEET_RANGE || "Réponses!A1:K";
const SHEET_GID = process.env.SHEET_GID || "";

/* ===================== Utils ===================== */
export function norm(s: string) {
  return String(s)
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

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
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

/* ========= Mapping par défaut (sans en-tête explicite) ========= */
const NO_HEADER_COLS = {
  prenom: 1,        // date/heure en col0, prénom en col1
  nom: 1,
  age: 2,           // âge en col2
  poids: 3,         // poids en col3
  taille: 4,
  niveau: 5,
  objectif: 6,
  disponibilite: 7,
  materiel: 8,
  lieu: 9,
  email: 10,
};

function guessEmailColumn(values: string[][]): number {
  const width = Math.max(...values.map((r) => r.length));
  let bestIdx = -1;
  let bestScore = -1;
  for (let j = 0; j < width; j++) {
    let score = 0;
    for (let i = 0; i < values.length; i++) {
      const cell = (values[i]?.[j] || "").trim();
      if (isEmail(cell)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = j;
    }
  }
  return bestIdx;
}

function guessAgeFromRow(row: string[]): number | undefined {
  for (const cell of row) {
    const n = readNum(cell);
    if (typeof n === "number" && n >= 8 && n <= 100 && Number.isInteger(n)) {
      return n;
    }
  }
  return undefined;
}

function guessFirstnameFromRow(row: string[], preferIdx?: number): string | undefined {
  if (typeof preferIdx === "number" && row[preferIdx]) {
    const v = row[preferIdx].trim();
    if (v && !isEmail(v) && !/\d/.test(v)) return v;
  }
  for (let j = 0; j < row.length; j++) {
    const v = (row[j] || "").trim();
    if (!v) continue;
    if (isEmail(v)) continue;
    if (/\d/.test(v)) continue;
    if (v.length >= 2 && v.length <= 30) return v;
  }
  return undefined;
}

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
    idxEmail = NO_HEADER_COLS.email;
    if (idxEmail >= width) idxEmail = -1;
    if (idxEmail === -1) {
      idxEmail = guessEmailColumn(values);
    }
  }

  if (idxEmail === -1) {
    // scan brut si on n'a pas trouvé la colonne email
    for (let i = values.length - 1; i >= 0; i--) {
      const row = values[i] || [];
      for (let j = 0; j < row.length; j++) {
        if ((row[j] || "").trim().toLowerCase() === email.trim().toLowerCase()) {
          idxEmail = j;
          break;
        }
      }
      if (idxEmail !== -1) break;
    }
  }

  if (idxEmail === -1) return null;

  const start = hasHeader ? 1 : 0;
  for (let i = values.length - 1; i >= start; i--) {
    const row = values[i] || [];
    const cellAtEmailCol = (row[idxEmail] || "").trim().toLowerCase();
    if (cellAtEmailCol !== email.trim().toLowerCase()) {
      if (!hasHeader) {
        const anyCell = row.find(
          (c) => (c || "").trim().toLowerCase() === email.trim().toLowerCase()
        );
        if (!anyCell) continue;
      } else {
        continue;
      }
    }

    const rec: Answers = {};
    for (let j = 0; j < row.length; j++) {
      const key = hasHeader ? (headers[j] || `col${j}`) : `col${j}`;
      rec[key] = (row[j] ?? "").trim();
    }

    // Normalisation des champs clés
    rec["email"] =
      rec["email"] ||
      rec["adresse mail"] ||
      rec["e-mail"] ||
      rec["mail"] ||
      rec[`col${idxEmail}`] ||
      rec[`col${NO_HEADER_COLS.email}`] ||
      "";

    rec["objectif"] =
      rec["objectif"] || rec[`col${NO_HEADER_COLS.objectif}`] || "";

    rec["niveau"] =
      rec["niveau"] || rec[`col${NO_HEADER_COLS.niveau}`] || "";

    rec["lieu"] =
      rec["lieu"] || rec[`col${NO_HEADER_COLS.lieu}`] || "";

    rec["as tu du materiel a ta disposition"] =
      rec["as tu du materiel a ta disposition"] ||
      rec["as-tu du materiel a ta disposition"] ||
      rec["as-tu du matériel à ta disposition"] ||
      rec[`col${NO_HEADER_COLS.materiel}`] ||
      "";

    rec["disponibilite"] =
      rec["disponibilite"] ||
      rec["disponibilité"] ||
      rec[`col${NO_HEADER_COLS.disponibilite}`] ||
      "";

    rec["poids"] =
      rec["poids"] || rec["weight"] || rec[`col${NO_HEADER_COLS.poids}`] || "";

    rec["taille"] =
      rec["taille"] || rec["height"] || rec[`col${NO_HEADER_COLS.taille}`] || "";

    // ✅ prénom + âge (même sans en-tête)
    rec["prenom"] =
      rec["prenom"] ||
      rec["prénom"] ||
      rec[`col${NO_HEADER_COLS.prenom}`] ||
      guessFirstnameFromRow(row, NO_HEADER_COLS.prenom) ||
      "";

    rec["age"] =
      rec["age"] ||
      rec[`col${NO_HEADER_COLS.age}`] ||
      (guessAgeFromRow(row)?.toString() ?? "");

    return rec;
  }
  return null;
}

/* ===================== Implémentations locales (identiques à avant) ===================== */

function mapGoal(s?: string): Goal {
  const g = norm(s || "");
  if (g.includes("force")) return "strength";
  if (g.includes("hypert")) return "hypertrophy";
  if (g.includes("gras") || g.includes("perte")) return "fatloss";
  if (g.includes("endurance") || g.includes("cardio")) return "endurance";
  if (g.includes("mobil")) return "mobility";
  return "general";
}

function mapLevel(s?: string): Profile["level"] {
  const l = norm(s || "");
  if (l.startsWith("deb")) return "debutant";
  if (l.startsWith("inter")) return "intermediaire";
  if (l.startsWith("av")) return "avance";
  return "debutant";
}

function mapEquipLevel(s?: string): EquipLevel {
  const t = norm(s || "");
  if (!t) return "none";
  if (t.includes("barre") || t.includes("rack") || t.includes("complet"))
    return "full";
  if (t.includes("halter") || t.includes("kettle") || t.includes("elasti"))
    return "limited";
  return "none";
}

export function buildProfileFromAnswers(answers: Answers): Profile {
  const weight = readNum(answers["poids"] || answers["weight"] || "");
  const height = readNum(answers["taille"] || answers["height"] || "");
  const imc =
    weight && height ? +(weight / Math.pow((height ?? 0) / 100, 2)).toFixed(1) : undefined;

  const freq =
    readNum(answers["disponibilite"] || answers["fréquence"] || "") ?? 3;

  const timePerSession = readNum(
    answers["temps par séance"] ||
      answers["durée séance"] ||
      answers["duree seance"] ||
      ""
  ) ?? 45;

  const locationStr = norm(answers["lieu"] || "");
  const location: Profile["location"] =
    locationStr.includes("maison") || locationStr.includes("home")
      ? "home"
      : locationStr.includes("salle") || locationStr.includes("gym")
      ? "gym"
      : locationStr.includes("extérieur") || locationStr.includes("exterieur")
      ? "outdoor"
      : "mixed";

  const equipItems = (answers["as tu du materiel a ta disposition"] || "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const ageParsed = readNum(answers["age"] || "");
  const age =
    typeof ageParsed === "number" && ageParsed > 0 ? Math.floor(ageParsed) : undefined;

  return {
    email: (answers["email"] || "").trim().toLowerCase(),
    prenom: answers["prenom"] || answers["prénom"],
    age,
    height: height ?? undefined,
    weight: weight ?? undefined,
    imc,
    goal: mapGoal(answers["objectif"]),
    subGoals: [],
    level: mapLevel(answers["niveau"]),
    freq,
    timePerSession,
    equipLevel: mapEquipLevel(
      answers["as tu du materiel a ta disposition"] || ""
    ),
    equipItems,
    gym: location === "gym",
    location,
    injuries: (answers["blessures"] || "")
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function generateProgrammeFromAnswers(answers: Answers): AiProgramme {
  const p = buildProfileFromAnswers(answers);
  const today = new Date();
  const sessions: AiSession[] = Array.from({ length: p.freq }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const type: WorkoutType =
      p.goal === "endurance"
        ? "cardio"
        : p.goal === "mobility"
        ? "mobilité"
        : "muscu";
    return {
      id: `${p.email}-${d.toISOString().slice(0, 10)}`,
      title:
        type === "muscu"
          ? "Full body"
          : type === "cardio"
          ? "Cardio structuré"
          : "Mobilité",
      type,
      date: d.toISOString().slice(0, 10),
      plannedMin: p.timePerSession,
      intensity:
        p.goal === "fatloss" || p.goal === "strength" ? "modérée" : "faible",
      exercises:
        type === "muscu"
          ? [
              { name: "Squat goblet", sets: 3, reps: "10-12", rest: "60-90s", block: "principal" },
              { name: "Rowing haltère", sets: 3, reps: "8-10", rest: "60-90s", block: "principal" },
              { name: "Pompes", sets: 3, reps: "max-2", rest: "60s", block: "principal" },
            ]
          : type === "cardio"
          ? [
              { name: "Intervals 4x4", durationSec: 4 * 60 * 4, notes: "RPE 7-8", block: "principal" },
            ]
          : [
              { name: "Flow hanches/chevilles", durationSec: 10 * 60, block: "principal" },
            ],
    };
  });
  return { sessions };
}

export async function getProgrammeForUser(email: string): Promise<AiProgramme | null> {
  const ans = await getAnswersForEmail(email);
  if (!ans) return null;
  return generateProgrammeFromAnswers(ans);
}

export async function getAiSessions(email?: string): Promise<AiSession[]> {
  const e =
    email ||
    cookies().get("app_email")?.value || // cookie correct
    "";

  if (!e) return [];
  const prog = await getProgrammeForUser(e);
  return prog?.sessions ?? [];
}

/* ===================== Accès profil (SANS DB / SANS PRISMA) ===================== */

/**
 * Upsert factice par e-mail :
 * - valide l'email
 * - pose le cookie "app_email" (source de vérité locale)
 * - renvoie un profil minimal
 */
export async function upsertUserProfileByEmail(
  email: string,
  extra?: { prenom?: string }
): Promise<UserProfile> {
  const e = (email || "").trim().toLowerCase();
  if (!isEmail(e)) throw new Error("EMAIL_INVALID");

  try {
    cookies().set("app_email", e, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    });
  } catch {
    // contexte hors requête — ignorer
  }

  return { id: e, email: e, prenom: extra?.prenom ?? null };
}

/**
 * Lecture factice du profil :
 * - retourne un profil minimal basé sur l'email fourni
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const e = (email || "").trim().toLowerCase();
  if (!isEmail(e)) return null;
  return { id: e, email: e, prenom: null };
}
