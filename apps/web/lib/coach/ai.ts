// apps/web/lib/coach/ai.ts
/** ---------------------------------------------------------------------------
 *  Public Google Sheet (CSV)
 *  - Env requis: SHEET_ID, SHEET_GID, SHEET_RANGE
 *  - Télécharge le CSV export, parse sans lib, et retourne la DERNIÈRE ligne.
 *  -------------------------------------------------------------------------*/

export type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

export type NormalizedExercise = {
  name: string;
  sets?: number;
  reps?: string;
  durationSec?: number;
  rest?: string;
  tempo?: string;
  rir?: number;
  load?: string | number;
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
  objectif?: string;
  goal?: string;
};

// --- ENV & URL helpers ---
const SHEET_ID = process.env.SHEET_ID || "";
const SHEET_GID = process.env.SHEET_GID || "";
const SHEET_RANGE = process.env.SHEET_RANGE || ""; // ex: "A:Z" ou "A1:K999"

function sheetCsvUrl(cacheBust?: boolean): string {
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}/export?format=csv`;
  const qp = new URLSearchParams();
  if (SHEET_GID) qp.set("gid", SHEET_GID);
  if (SHEET_RANGE) qp.set("range", SHEET_RANGE);
  if (cacheBust) qp.set("_", String(Date.now())); 
  const qs = qp.toString();
  return qs ? `${base}&${qs}` : base;
}

// --- Cache mémoire (TTL) ---
const GLOBAL_CACHE_KEY = "__ai_sheet_cache__";
const CACHE_TTL_MS = Number(process.env.SHEET_CACHE_TTL_MS || 5000);
type CacheT = { at: number; text: string };

declare global {
  // @ts-ignore
  var __ai_sheet_cache__: CacheT | undefined;
}

// --- CSV parsing ---
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
        if (next === '"') { cell += '"'; i += 2; continue; }
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
  if (cell.length > 0 || cur.length > 0) pushRow();
  return rows;
}

// --- CSV fetch ---
async function fetchSheetCSVRaw(fresh = false): Promise<string> {
  if (!SHEET_ID || !SHEET_GID) throw new Error("SHEET_ID et SHEET_GID requis.");
  const url = sheetCsvUrl(!!fresh);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  return res.text();
}

async function fetchSheetCSV(fresh = false): Promise<string[][]> {
  const now = Date.now();
  const cached: CacheT | undefined = (global as any)[GLOBAL_CACHE_KEY];
  if (!fresh && cached && now - cached.at < CACHE_TTL_MS) {
    return parseCSV(cached.text);
  }
  const text = await fetchSheetCSVRaw(!!fresh);
  (global as any)[GLOBAL_CACHE_KEY] = { at: now, text };
  return parseCSV(text);
}

// --- Détection colonnes ---
type ColIdxMap = { [key: string]: number };
const DEFAULT_IDX: ColIdxMap = { prenom: 1, age: 2, objectif: 6, email: 9, ts: 0 };

function toIndexFromLetter(letter: string): number {
  let idx = 0;
  const s = letter.replace(/[^A-Za-z]/g, "").toUpperCase();
  for (let i = 0; i < s.length; i++) idx = idx * 26 + (s.charCodeAt(i) - 64);
  return Math.max(0, idx - 1);
}

function detectIndexes(rows: string[][]): ColIdxMap {
  if (!rows.length) return { ...DEFAULT_IDX };
  const header = rows[0].map((h) => (h || "").trim().toLowerCase());
  const map: ColIdxMap = { ...DEFAULT_IDX };
  const find = (keys: string[]) => header.findIndex((h) => keys.includes(h));

  const emailIdx = find(["email", "e-mail", "mail", "adresse e-mail", "adresse email"]);
  if (emailIdx >= 0) map.email = emailIdx;

  const prenomIdx = find(["prenom", "prénom", "first name", "firstname"]);
  if (prenomIdx >= 0) map.prenom = prenomIdx;

  const ageIdx = find(["age", "âge"]);
  if (ageIdx >= 0) map.age = ageIdx;

  const objIdx = find(["objectif", "goal", "objectif (g)"]);
  if (objIdx >= 0) map.objectif = objIdx;

  const tsIdx = find(["timestamp","ts","date","submitted at","horodatage","date de soumission","date/heure"]);
  if (tsIdx >= 0) map.ts = tsIdx;

  return map;
}

// --- Normalisation objectif
function normalizeGoal(input?: string): string {
  const s = String(input || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

  if (!s) return "";

  // Mapping muscles → hypertrophy
  if (/(epaule|epaules|epaul|shoulder|delts?)/.test(s)) return "hypertrophy";
  if (/(pec|poitrine|torse)/.test(s)) return "hypertrophy";
  if (/(dos|back|dorsaux)/.test(s)) return "hypertrophy";
  if (/(bras|biceps|triceps)/.test(s)) return "hypertrophy";
  if (/(abdos|abdominal|ventre|core)/.test(s)) return "hypertrophy";
  if (/(fessier|fesse|glutes)/.test(s)) return "hypertrophy";
  if (/(ischio|hamstring)/.test(s)) return "hypertrophy";
  if (/(quadri|cuisses|quads)/.test(s)) return "hypertrophy";
  if (/(jambes|bas du corps|lower body)/.test(s)) return "hypertrophy";
  if (/(mollet|calves)/.test(s)) return "hypertrophy";

  // Objectifs globaux
  if (/(hypertroph|esthetique|prise de muscle|prise de masse)/.test(s)) return "hypertrophy";
  if (/(perte|seche|gras|minceur|weight loss|fat)/.test(s)) return "fatloss";
  if (/(force|strength)/.test(s)) return "strength";
  if (/(endurance|cardio|z2|course|velo|run)/.test(s)) return "endurance";
  if (/(mobilite|souplesse|flexibilite)/.test(s)) return "mobility";

  return "general";
}

// --- Horodatage
function parseTimestampLoose(input: any): number {
  if (!input) return 0;
  const s = String(input).trim();
  let t = Date.parse(s);
  if (!Number.isNaN(t)) return t;

  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, hh = "0", mm = "0", ss = "0"] = m;
    const Y = Number((y.length === 2 ? "20" + y : y));
    const date = new Date(Y, Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    const tt = date.getTime();
    if (!Number.isNaN(tt)) return tt;
  }
  return 0;
}

// --- Lire dernière ligne client
export async function getAnswersForEmail(
  email: string,
  opts?: { fresh?: boolean }
): Promise<Record<string, any> | null> {
  const emailLc = String(email || "").trim().toLowerCase();
  if (!emailLc) return null;

  const rows = await fetchSheetCSV(!!opts?.fresh);
  if (!rows.length) return null;

  const idx = detectIndexes(rows);
  const header = rows[0] || [];
  const hasHeader =
    (header[idx.email] || "").toString().toLowerCase() === "email" ||
    (header[idx.email] || "").toString().toLowerCase() === "adresse e-mail" ||
    (header[idx.email] || "").toString().toLowerCase() === "adresse email";
  const start = hasHeader ? 1 : 0;

  let latest: { row: string[]; ts: number; i: number } | null = null;
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const rowMail = String(row[idx.email] || "").trim().toLowerCase();
    if (rowMail !== emailLc) continue;
    const tsNum = parseTimestampLoose(row[idx.ts]);
    if (!latest || tsNum > latest.ts || (tsNum === latest.ts && i > latest.i)) {
      latest = { row, ts: tsNum, i };
    }
  }
  if (!latest) return null;

  const obj: Record<string, any> = {};
  if (hasHeader) {
    for (let c = 0; c < latest.row.length; c++) {
      const key = String(header[c] || `col_${c}`).trim();
      obj[key] = latest.row[c];
    }
  } else {
    obj["col_B"] = latest.row[1] || "";
    obj["col_C"] = latest.row[2] || "";
    obj["col_D"] = latest.row[3] || "";
    obj["col_E"] = latest.row[4] || "";
    obj["col_F"] = latest.row[5] || "";
    obj["col_G"] = latest.row[6] || "";
    obj["col_H"] = latest.row[7] || "";
    obj["col_I"] = latest.row[8] || "";
    obj["col_J"] = latest.row[9] || "";
    obj["col_K"] = latest.row[10] || "";
    obj["email"] = latest.row[idx.email] || emailLc;
    obj["ts"] = latest.row[idx.ts] || "";
  }
  obj["email"] = obj["email"] || emailLc;
  return obj;
}

// --- Profil de base
export function buildProfileFromAnswers(ans: Record<string, any>): Profile {
  if (!ans) return {};
  const prenom = ans["prenom"] ?? ans["prénom"] ?? ans["first name"] ?? ans["firstname"] ?? ans["col_B"] ?? "";
  const ageRaw = ans["age"] ?? ans["âge"] ?? ans["col_C"] ?? "";
  const objectifBrut = ans["objectif"] ?? ans["goal"] ?? ans["col_G"] ?? "";
  const email = ans["email"] ?? ans["mail"] ?? ans["e-mail"] ?? ans["col_K"] ?? "";
  const age = typeof ageRaw === "number" ? ageRaw : Number(String(ageRaw).replace(/[^\d.-]/g, ""));
  const goal = normalizeGoal(String(objectifBrut));

  return {
    email: String(email || "").trim().toLowerCase() || undefined,
    prenom: (typeof prenom === "string" ? prenom.trim() : "") || undefined,
    age: Number.isFinite(age) && age > 0 ? age : undefined,
    objectif: String(objectifBrut || "").trim() || undefined,
    goal: goal || undefined,
  };
}

// --- Génération programme
import { planProgrammeFromProfile } from "./beton";

function normLevel(s: string | undefined) {
  const v = String(s || "").toLowerCase();
  if (/avanc/.test(v)) return "avance";
  if (/inter/.test(v)) return "intermediaire";
  if (/deb|déb/.test(v)) return "debutant";
  return "" as any;
}

function normEquipLevel(s: string | undefined): "none" | "limited" | "full" {
  const v = String(s || "").toLowerCase();
  if (/none|aucun|sans/.test(v)) return "none";
  if (/full|complet|salle|gym|machines|barres/.test(v)) return "full";
  if (!v) return "limited";
  return "limited";
}

function toNumber(x: any): number | undefined {
  const n = Number(String(x ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function splitList(s: any): string[] | undefined {
  const txt = String(s || "").trim();
  if (!txt) return undefined;
  return txt.split(/[;,/|]/).map((t) => t.trim()).filter(Boolean);
}

// Table muscles → exos favoris
const muscleLikes: Record<string, string[]> = {
  pec: ["développé couché", "pompes", "écarté haltères"],
  dos: ["tractions", "rowing", "tirage horizontal"],
  epaules: ["élevations latérales", "développé haltères", "face pull", "élévations frontales"],
  bras: ["curl biceps", "extension triceps", "hammer curl"],
  abdos: ["crunch", "gainage", "mountain climbers"],
  fessier: ["hip thrust", "glute bridge", "fentes"],
  ischio: ["leg curl", "soulevé de terre jambes tendues"],
  quadri: ["squat", "fentes", "leg extension"],
  jambes: ["squat", "fentes", "mollets debout"],
  mollet: ["mollets debout", "mollets assis"],
};

export function generateProgrammeFromAnswers(ans: Record<string, any>): { sessions: AiSession[] } {
  const profile = buildProfileFromAnswers(ans);

  const level =
    normLevel(
      (ans["niveau"] ??
        ans["level"] ??
        ans["experience"] ??
        ans["expérience"] ??
        ans["col_D"]) as string | undefined
    ) || undefined;

  const equipLevel =
    (normEquipLevel(
      (ans["equipLevel"] ??
        ans["matériel"] ??
        ans["materiel"] ??
        ans["equipment_level"] ??
        ans["col_E"]) as string | undefined
    ) || "limited") as "none" | "limited" | "full";

  const timePerSession =
    toNumber(ans["timePerSession"] ?? ans["durée"] ?? ans["duree"] ?? ans["col_F"]) ??
    (profile.age && profile.age > 50 ? 35 : undefined) ??
    45;

  const injuries =
    splitList(ans["injuries"] ?? ans["blessures"] ?? ans["col_H"]) || undefined;

  const daysPerWeek =
    Math.max(1, Math.min(6, toNumber(ans["daysPerWeek"] ?? ans["jours"] ?? ans["séances/semaine"] ?? ans["seances/semaine"] ?? ans["col_I"]) || 3));

  const equipItems =
    splitList(ans["equipItems"] ?? ans["équipements"] ?? ans["equipements"] ?? ans["col_J"]) || undefined;

  // Détection multi-muscles
  const objectifTxt = String(profile.objectif || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const foundLikes: string[] = [];
  for (const [muscle, exos] of Object.entries(muscleLikes)) {
    if (objectifTxt.includes(muscle)) {
      foundLikes.push(...exos);
    }
  }
  const likes = foundLikes.length > 0 ? foundLikes : undefined;

  const enriched = {
    prenom: profile.prenom,
    age: profile.age,
    objectif: profile.objectif,
    goal: profile.goal,
    equipLevel,
    timePerSession,
    level,
    injuries,
    equipItems,
    likes,
  } as any;

  return planProgrammeFromProfile(enriched, { maxSessions: daysPerWeek });
}

// 4) Sessions “stockées” (stub)
export async function getAiSessions(_email: string): Promise<AiSession[]> {
  return [];
}
