// lib/coach/ai.ts
import { parse } from "csv-parse/sync";

/** ========= Types ========= */
export type Profile = {
  email: string;
  prenom?: string;
  age?: number;
  objectif?: string;   // libellé FR pour l’UI
  goal?: "hypertrophy" | "fatloss" | "strength" | "endurance" | "mobility" | "general";
};

export type AiSession = {
  id: string;
  title: string;
  type: "muscu" | "cardio" | "hiit" | "mobilité";
  date: string;            // YYYY-MM-DD
  plannedMin?: number;
  intensity?: string;
  exercises?: Array<{ name: string; sets: number; reps: string; rest: string; block?: string }>;
};

type RawAnswer = {
  ts: Date;
  prenom?: string;
  age?: number;
  objectifBrut?: string;
  email: string;
};

/** ========= ENV =========
 *  Utilise SNAKE_CASE comme convenu
 *  SHEET_ID : id du doc
 *  SHEET_GID: gid numérique de l’onglet
 *  SHEET_RANGE: ex "A:J" (indicatif, sert juste de repère pour les index)
 */
const SHEET_ID = process.env.SHEET_ID!;
const SHEET_GID = process.env.SHEET_GID!;
const SHEET_RANGE = process.env.SHEET_RANGE || "A:J";

/** URL CSV publique de l’onglet */
function publicCsvUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
}

/** ========= Helpers ========= */
function normalizeEmail(s: string) { return (s || "").trim().toLowerCase(); }
function toNumberSafe(v: any): number | undefined {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
function parseFrenchDateTime(v: string): Date | null {
  // "dd/MM/yyyy HH:mm:ss" (format Google Form FR habituel)
  const m = v?.match?.(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, HH, MM, SS] = m;
  return new Date(+yyyy, +mm - 1, +dd, +HH, +MM, +SS);
}
function normalizeGoalKey(s: string): NonNullable<Profile["goal"]> | undefined {
  const x = (s || "").toLowerCase();
  if (/(pdm|prise de masse|prise de poids|hypertroph)/.test(x)) return "hypertrophy";
  if (/(perte|secher|poid|gras)/.test(x)) return "fatloss";
  if (/(force)/.test(x)) return "strength";
  if (/(endur)/.test(x)) return "endurance";
  if (/(mobilit|souplesse)/.test(x)) return "mobility";
  if (x) return "general";
  return undefined;
}
function goalLabelFromKey(k?: Profile["goal"]) {
  if (!k) return undefined;
  return {
    hypertrophy: "Hypertrophie / Esthétique",
    fatloss: "Perte de gras",
    strength: "Force",
    endurance: "Endurance / Cardio",
    mobility: "Mobilité / Souplesse",
    general: "Forme générale",
  }[k];
}

/** ========= Index des colonnes (0-based) selon A:J =========
 *  Adapte si ton onglet change :
 *  A: horodatage | B: prénom | C: âge | G: objectif brut | J: email
 */
const IDX = { ts: 0, prenom: 1, age: 2, objectif: 6, email: 9 };

/** ====== Lecture de la DERNIÈRE réponse pour un email (Sheet public CSV) ====== */
export async function getAnswersForEmail(email: string): Promise<RawAnswer | null> {
  const em = normalizeEmail(email);
  if (!em) return null;

  const res = await fetch(publicCsvUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();

  const rows: string[][] = parse(text, { skip_empty_lines: true });
  if (!rows.length) return null;

  const matches: RawAnswer[] = [];
  for (let i = 1; i < rows.length; i++) { // saute l'entête
    const r = rows[i];
    if (!r || r.length <= Math.max(IDX.ts, IDX.email)) continue;

    const tsStr = r[IDX.ts] || "";
    const ts = parseFrenchDateTime(tsStr) || new Date(tsStr || Date.now());
    const prenom = (r[IDX.prenom] || "").trim();
    const age = toNumberSafe(r[IDX.age]);
    const objectifBrut = (r[IDX.objectif] || "").trim();
    const mail = normalizeEmail(r[IDX.email] || "");
    if (mail === em) matches.push({ ts, prenom, age, objectifBrut, email: mail });
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  return matches[matches.length - 1];
}

/** Construit le profil pour l’UI */
export function buildProfileFromAnswers(ans: RawAnswer): Profile {
  const goalKey = normalizeGoalKey(ans.objectifBrut || "");
  return {
    email: ans.email,
    prenom: ans.prenom || undefined,
    age: ans.age,
    goal: goalKey,
    objectif: goalLabelFromKey(goalKey),
  };
}

/** ====== Stubs compatibles avec le reste de ton app ====== */
export function generateProgrammeFromAnswers(_ans: RawAnswer): { sessions: AiSession[] } {
  return { sessions: [] }; // adapte si tu veux générer des séances depuis les réponses
}
export async function getAiSessions(_email: string): Promise<AiSession[]> {
  return []; // adapte si tu as une source secondaire
}
// Si tu avais des fonctions DB avant, garde des stubs vides :
export async function getUserProfileByEmail(_email: string): Promise<{ email: string; prenom?: string | null } | null> {
  return null;
}
