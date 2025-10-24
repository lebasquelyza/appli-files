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

async function fetchSheetCSV(): Promise<string[][]> {
  if (!SHEET_ID || !SHEET_GID) throw new Error("SHEET_ID et SHEET_GID requis.");
  const now = Date.now();
  const cached: CacheT | undefined = (global as any)[GLOBAL_CACHE_KEY];
  if (cached && now - cached.at < 60_000) {
    return parseCSV(cached.text);
  }
  const url = sheetCsvUrl();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  const text = await res.text();
  (global as any)[GLOBAL_CACHE_KEY] = { at: now, text };
  return parseCSV(text);
}

// --- Aide : accès colonne par nom ou index fallback ---
type ColIdxMap = { [key: string]: number };

// Par défaut si pas d’en-têtes: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10
// On veut B=1 (prenom), C=2 (age), G=6 (objectif), K=10 (email par défaut si override via env), etc.
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

  // Override via lettres si défini (ex: SHEET_EMAIL_COL="K")
  const letterOverride = (envName: string) => {
    const v = (process.env[envName] || "").trim();
    return v ? toIndexFromLetter(v) : null;
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

  if (/(hypertroph|esthetique|prise de muscle|prise de masse)/.test(s)) return "hypertrophy";
  if (/(perte|seche|gras|minceur|weight loss|fat)/.test(s)) return "fatloss";
  if (/(force|strength)/.test(s)) return "strength";
  if (/(endurance|cardio|z2|course|velo|vélo|run)/.test(s)) return "endurance";
  if (/(mobilite|mobilité|souplesse|flexibilite)/.test(s)) return "mobility";
  return "general";
}

/* ============================================================================
 *  Helpers de disponibilités (texte) pour la logique jours → séances
 * ==========================================================================*/
function availabilityTextFromAnswers(ans: Record<string, any>): string | undefined {
  if (!ans) return undefined;
  const dayPat = /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week\s*-?\s*end|weekend|jours?\s+par\s+semaine|\b\d+\s*(x|fois|jours?))/i;

  // Colonne “I” (fallback) en priorité si présente
  const candidates: any[] = [
    ans["daysPerWeek"], ans["jours"], ans["séances/semaine"], ans["seances/semaine"], ans["col_I"]
  ];

  // Puis on scanne toutes les valeurs texte pour attraper “lundi mardi”, “week-end”, “6 jours…”
  for (const k of Object.keys(ans)) {
    const v = ans[k];
    if (typeof v === "string") candidates.push(v);
  }

  const hits = candidates
    .map((v) => String(v ?? "").trim())
    .filter((v) => v && dayPat.test(v));

  return hits.length ? hits.join(" ; ") : undefined;
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
  const start = rows[0]?.[idx.email]?.toLowerCase() === "email" ? 1 : 0;

  let latest: { row: string[]; ts: number; i: number } | null = null;

  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const rowMail = String(row[idx.email] || "").trim().toLowerCase();
    if (rowMail !== emailLc) continue;

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

  const headerRow = rows[0] || [];
  const hasHeader = headerRow[idx.email]?.toLowerCase() === "email";
  const obj: Record<string, any> = {};

  if (hasHeader) {
    for (let c = 0; c < latest.row.length; c++) {
      const key = String(headerRow[c] || `col_${c}`).trim();
      obj[key] = latest.row[c];
    }
  } else {
    // ⚙️ Fallback sans en-têtes : on expose B..K pour nos usages
    obj["col_B"] = latest.row[1] || "";  // Prenom
    obj["col_C"] = latest.row[2] || "";  // Age
    obj["col_D"] = latest.row[3] || "";  // Niveau
    obj["col_E"] = latest.row[4] || "";  // Matériel (none/limited/full)
    obj["col_F"] = latest.row[5] || "";  // Durée (min)
    obj["col_G"] = latest.row[6] || "";  // Objectif (libellé)
    obj["col_H"] = latest.row[7] || "";  // Blessures
    obj["col_I"] = latest.row[8] || "";  // Jours / semaine
    obj["col_J"] = latest.row[9] || "";  // Équipements détaillés (liste)
    obj["col_K"] = latest.row[10] || ""; // Email (si c'est là)
    obj["email"] = latest.row[idx.email] || emailLc;
    obj["ts"] = latest.row[idx.ts] || "";
  }

  obj["email"] = obj["email"] || emailLc;

  return obj;
}

// 2) Construire un profil depuis la ligne réponse (base: prenom/age/objectif/email)
export function buildProfileFromAnswers(ans: Record<string, any>): Profile {
  if (!ans) return {};

  const prenom =
    ans["prenom"] ?? ans["prénom"] ?? ans["first name"] ?? ans["firstname"] ?? ans["col_B"] ?? "";

  const ageRaw = ans["age"] ?? ans["âge"] ?? ans["col_C"] ?? "";

  const objectifBrut = ans["objectif"] ?? ans["goal"] ?? ans["col_G"] ?? "";

  const email = ans["email"] ?? ans["mail"] ?? ans["e-mail"] ?? ans["col_K"] ?? "";

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
 *  3) Générer un programme (branché sur coach/beton)
 * ==========================================================================*/
import { planProgrammeFromProfile } from "./beton";

/* Helpers de normalisation pour champs étendus (D..J) */
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

export function generateProgrammeFromAnswers(ans: Record<string, any>): { sessions: AiSession[] } {
  const profile = buildProfileFromAnswers(ans);

  // Lecture “souple” des colonnes D..J (avec fallback col_D..col_J si pas d’en-têtes)
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

  // 1) Nombre explicite (ex: “3”, “6”) — borne 1..6
  const numericDays =
    toNumber(
      ans["daysPerWeek"] ??
      ans["jours"] ??
      ans["séances/semaine"] ??
      ans["seances/semaine"] ??
      ans["col_I"]
    );
  const daysPerWeek = numericDays ? Math.max(1, Math.min(6, numericDays)) : undefined;

  // 2) Texte de dispos (ex: “lundi mardi”, “week-end”, “6 jours par semaine”)
  const availabilityText = availabilityTextFromAnswers(ans);

  const equipItems =
    splitList(ans["equipItems"] ?? ans["équipements"] ?? ans["equipements"] ?? ans["col_J"]) || undefined;

  // Payload enrichi pour le moteur “béton”
  const enriched = {
    prenom: profile.prenom,
    age: profile.age,
    objectif: profile.objectif, // libellé brut -> affichage
    goal: profile.goal,         // clé normalisée -> logique
    equipLevel,
    timePerSession,
    level,
    injuries,
    equipItems,
    // ⬇️ Clé utilisée par le moteur béton pour inférer le nombre de séances (jours nommés, week-end, 6x...)
    availabilityText,
  } as any;

  // Priorité: si on a un NOMBRE → on l’applique; sinon, le moteur infèrera depuis availabilityText
  const res = planProgrammeFromProfile(enriched, { maxSessions: daysPerWeek });

  // ✅ Fix de typage: on force `type` dans l’union littérale WorkoutType
  return {
    sessions: res.sessions.map((s) => ({
      ...s,
      type: s.type as WorkoutType,
    })),
  };
}

// 4) Sessions “stockées” (stub) — ici on retourne vide pour laisser la génération locale prendre le relais
export async function getAiSessions(_email: string): Promise<AiSession[]> {
  // Branche ici une DB/Supabase si tu veux persister les programmes.
  return [];
}
