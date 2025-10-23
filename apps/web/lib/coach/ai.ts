// apps/web/lib/coach/ai.ts

/** ---------------------------------------------------------------------------
 *  Public Google Sheet (CSV)
 *  - Env requis: SHEET_ID, SHEET_GID, SHEET_RANGE
 *  - On télécharge le CSV export et on parse sans lib externe.
 *  -------------------------------------------------------------------------*/

export type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

export type NormalizedExercise = {
  name: string;
  sets?: number;
  reps?: string;            // ex: "8–12" ou "10–12/ côté"
  durationSec?: number;     // alternative à reps
  rest?: string;            // "60–90s"
  tempo?: string;           // "3011"
  rir?: number;             // reps in reserve
  load?: string | number;   // "léger" / "modéré" / 20kg ...
  block?: "echauffement" | "principal" | "accessoires" | "fin";
  equipment?: string;
  target?: string;
  alt?: string;
  notes?: string;
  videoUrl?: string;
};

export type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string; // YYYY-MM-DD
  plannedMin?: number;
  intensity?: string;
  exercises?: NormalizedExercise[];
};

export type Profile = {
  email?: string;
  prenom?: string;
  age?: number;
  objectif?: string; // libellé FR brut (colonne G)
  goal?: string;     // clé normalisée (hypertrophy/fatloss/strength/endurance/mobility/general)
  // autres champs éventuels à l’avenir
};

// --- ENV & URL helpers ---
const SHEET_ID = process.env.SHEET_ID || "";
const SHEET_GID = process.env.SHEET_GID || "";
const SHEET_RANGE = process.env.SHEET_RANGE || ""; // ex: "A:Z" ou "A1:K999"

function sheetCsvUrl(): string {
  // CSV export de Google Sheets avec gid + range
  // NB: range est optionnel; si vide, Google renvoie toute la feuille.
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}/export?format=csv`;
  const qp = new URLSearchParams();
  if (SHEET_GID) qp.set("gid", SHEET_GID);
  if (SHEET_RANGE) qp.set("range", SHEET_RANGE);
  return `${base}&${qp.toString()}`;
}

// --- Petit cache mémoire (60s) pour éviter de spammer le CSV ---
const GLOBAL_CACHE_KEY = "__ai_sheet_cache__";
type CacheT = { at: number; text: string };
declare global { // eslint-disable-line no-var
  // @ts-ignore
  var __ai_sheet_cache__: CacheT | undefined;
}

// --- CSV parsing (sans dépendance) ---
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0, cur: string[] = [], cell = "", inQuotes = false;

  function pushCell() { cur.push(cell); cell = ""; }
  function pushRow()  { pushCell(); rows.push(cur); cur = []; }

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') { cell += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }

    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { pushCell(); i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { pushRow(); i++; continue; }
    cell += ch; i++;
  }
  // dernière cellule/ligne si non terminée
  if (cell.length > 0 || cur.length > 0) pushRow();
  return rows;
}

async function fetchSheetCSV(): Promise<string[][]> {
  if (!SHEET_ID || !SHEET_GID) throw new Error("SHEET_ID et SHEET_GID requis.");
  const now = Date.now();
  const cached: CacheT | undefined = (global as any)[GLOBAL_CACHE_KEY];
  if (cached && now - cached.at < 60_000) {
    return parseCSV(cached.text);
  }
  const url = sheetCsvUrl();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`CSV fetch failed (${res.status})`);
  }
  const text = await res.text();
  (global as any)[GLOBAL_CACHE_KEY] = { at: now, text };
  return parseCSV(text);
}

// --- Aide : accès colonne par nom ou index fallback ---
type ColIdxMap = { [key: string]: number };

// Par défaut si pas d’en-têtes: A=0, B=1, C=2, ... on veut B=1 (prenom), C=2 (age), G=6 (objectif), et email ~ J=9
// ⚠️ Tu peux override par env: SHEET_EMAIL_COL="K" si l'email est en colonne K.
const DEFAULT_IDX: ColIdxMap = { prenom: 1, age: 2, objectif: 6, email: 9, ts: 0 };

function toIndexFromLetter(letter: string): number {
  // "A"->0, "B"->1, "AA"->26...
  let idx = 0;
  const s = letter.replace(/[^A-Za-z]/g, "").toUpperCase();
  for (let i = 0; i < s.length; i++) idx = idx * 26 + (s.charCodeAt(i) - 64);
  return Math.max(0, idx - 1);
}

function detectIndexes(rows: string[][]): ColIdxMap {
  if (!rows.length) return { ...DEFAULT_IDX };
  const header = rows[0].map((h) => (h || "").trim().toLowerCase());
  // Si l’en-tête contient “email”, “prenom”, “âge/age”, “objectif”
  const map: ColIdxMap = { ...DEFAULT_IDX };
  const find = (keys: string[]) => header.findIndex((h) => keys.includes(h));

  const emailIdx = find(["email", "e-mail", "mail"]);
  if (emailIdx >= 0) map.email = emailIdx;

  const prenomIdx = find(["prenom", "prénom", "first name", "firstname"]);
  if (prenomIdx >= 0) map.prenom = prenomIdx;

  const ageIdx = find(["age", "âge"]);
  if (ageIdx >= 0) map.age = ageIdx;

  const objIdx = find(["objectif", "goal", "objectif (g)"]);
  if (objIdx >= 0) map.objectif = objIdx;

  const tsIdx = find(["timestamp", "ts", "date", "submitted at"]);
  if (tsIdx >= 0) map.ts = tsIdx;

  // Permettre override via env optionnelle SHEET_*_COL -> lettre (ex: "K")
  const letterOverride = (envName: string) => {
    const v = (process.env[envName] || "").trim();
    return v ? toIndexFromLetter(v) : null;
    // ex: SHEET_EMAIL_COL="K" -> 10
  };
  const oEmail = letterOverride("SHEET_EMAIL_COL");
  if (oEmail !== null) map.email = oEmail;
  const oPrenom = letterOverride("SHEET_PRENOM_COL");
  if (oPrenom !== null) map.prenom = oPrenom;
  const oAge = letterOverride("SHEET_AGE_COL");
  if (oAge !== null) map.age = oAge;
  const oObj = letterOverride("SHEET_OBJECTIF_COL");
  if (oObj !== null) map.objectif = oObj;

  return map;
}

// --- Normalisation “objectif” -> clé interne
function normalizeGoal(input?: string): string {
  const s = String(input || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

  if (!s) return "";

  // mappings fréquents
  if (/(hypertroph|esthetique|prise de muscle|prise de masse)/.test(s)) return "hypertrophy";
  if (/(perte|seche|gras|minceur|weight loss|fat)/.test(s)) return "fatloss";
  if (/(force|strength)/.test(s)) return "strength";
  if (/(endurance|cardio|z2|course|velo|vélo|run)/.test(s)) return "endurance";
  if (/(mobilite|mobilité|souplesse|flexibilite)/.test(s)) return "mobility";
  return "general";
}

/** ============================================================================
 *  API publique consommée par les pages
 *  ==========================================================================*/

// 1) Lire toutes les réponses et retourner la DERNIÈRE pour un email donné
export async function getAnswersForEmail(email: string): Promise<Record<string, any> | null> {
  const emailLc = String(email || "").trim().toLowerCase();
  if (!emailLc) return null;

  const rows = await fetchSheetCSV();
  if (!rows.length) return null;

  const idx = detectIndexes(rows);

  // Si la première ligne est un header (probable) et contient "email", on la zappe pour la recherche
  const start = rows[0]?.[idx.email]?.toLowerCase() === "email" ? 1 : 0;

  let latest: { row: string[]; ts: number; i: number } | null = null;

  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const rowMail = String(row[idx.email] || "").trim().toLowerCase();
    if (rowMail !== emailLc) continue;

    // timestamp si dispo
    let tsNum = 0;
    const tsRaw = row[idx.ts];
    if (tsRaw) {
      const t = new Date(tsRaw).getTime();
      if (!Number.isNaN(t)) tsNum = t;
    }
    if (!latest || tsNum >= (latest.ts || 0) || i > (latest.i || -1)) {
      latest = { row, ts: tsNum, i };
    }
  }

  if (!latest) return null;

  // construire un objet réponse clé->valeur basé soit sur header, soit sur indices
  const headerRow = rows[0] || [];
  const hasHeader = headerRow[idx.email]?.toLowerCase() === "email";
  const obj: Record<string, any> = {};

  if (hasHeader) {
    for (let c = 0; c < latest.row.length; c++) {
      const key = String(headerRow[c] || `col_${c}`).trim();
      obj[key] = latest.row[c];
    }
  } else {
    obj["col_B"] = latest.row[1] || ""; // prenom
    obj["col_C"] = latest.row[2] || ""; // age
    obj["col_G"] = latest.row[6] || ""; // objectif
    obj["email"] = latest.row[idx.email] || emailLc;
    obj["ts"] = latest.row[idx.ts] || "";
  }

  // Toujours refléter le mail clé 'email'
  obj["email"] = obj["email"] || emailLc;

  return obj;
}

// 2) Construire un profil depuis la ligne réponse
export function buildProfileFromAnswers(ans: Record<string, any>): Profile {
  if (!ans) return {};

  // lecture souple: soit via noms d’en-tête, soit via col_* fallback
  const prenom =
    ans["prenom"] ??
    ans["prénom"] ??
    ans["first name"] ??
    ans["firstname"] ??
    ans["col_B"] ??
    "";

  const ageRaw =
    ans["age"] ??
    ans["âge"] ??
    ans["col_C"] ??
    "";

  const objectifBrut =
    ans["objectif"] ??
    ans["goal"] ??
    ans["col_G"] ??
    "";

  const email =
    ans["email"] ??
    ans["mail"] ??
    ans["e-mail"] ??
    "";

  const age = typeof ageRaw === "number" ? ageRaw : Number(String(ageRaw).replace(/[^\d.-]/g, ""));
  const goal = normalizeGoal(String(objectifBrut));

  const profile: Profile = {
    email: String(email || "").trim().toLowerCase() || undefined,
    prenom: (typeof prenom === "string" ? prenom.trim() : "") || undefined,
    age: Number.isFinite(age) && age > 0 ? age : undefined,
    objectif: String(objectifBrut || "").trim() || undefined,
    goal: goal || undefined,
  };

  return profile;
}

/* ============================================================================
 *  3) Générer un programme (version “béton”)
 *  --------------------------------------------------------------------------
 *  On délègue la création des vraies séances au module coach/beton.
 *  Cette fonction conserve la même signature/export qu’avant.
 * ==========================================================================*/
import { planProgrammeFromProfile } from "./beton";

export function generateProgrammeFromAnswers(ans: Record<string, any>): { sessions: AiSession[] } {
  const profile = buildProfileFromAnswers(ans);

  // Enrichissement possible depuis les réponses brutes
  const enriched = {
    prenom: profile.prenom,
    age: profile.age,
    objectif: profile.objectif, // libellé brut (prioritaire pour l’affichage)
    goal: profile.goal,         // clé normalisée (pour la logique interne)
    equipLevel: (ans["equipLevel"] || ans["matériel"] || ans["equipment_level"] || "limited") as
      | "none" | "limited" | "full",
    timePerSession: Number(
      ans["timePerSession"] || ans["durée"] || (profile.age && profile.age > 50 ? 35 : 45)
    ),
    level: (String(ans["niveau"] || ans["level"] || "") as string).toLowerCase() as
      | "debutant"
      | "intermediaire"
      | "avance",
  };

  // ⚙️ Délégation au moteur “béton”
  return planProgrammeFromProfile(enriched, { maxSessions: 3 });
}

// 4) Sessions “stockées” (stub) — ici on retourne vide pour laisser la génération locale prendre le relais
export async function getAiSessions(_email: string): Promise<AiSession[]> {
  // Tu peux brancher ici une DB/Supabase/Redis si tu veux stocker des programmes.
  // Par défaut, on ne renvoie rien -> la page tentera generateProgrammeFromAnswers(answers).
  return [];
}
