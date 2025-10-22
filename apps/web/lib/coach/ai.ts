// lib/coach/ai.ts
import { google } from "googleapis";

export type Profile = {
  email: string;
  prenom?: string;
  age?: number;
  objectif?: string;   // label human (ex: "Perte de gras")
  goal?: "hypertrophy" | "fatloss" | "strength" | "endurance" | "mobility" | "general";
};

type RawAnswer = {
  ts: Date;
  prenom?: string;
  age?: number;
  intensite?: string;
  objectifBrut?: string;
  jours?: string;
  lieu?: string;
  email: string;
};

const SHEET_ID = process.env.COACH_SHEET_ID_PROD!;       // <<< mets l’ID du Sheet "prod"
const SHEET_RANGE = process.env.COACH_SHEET_RANGE || "Reponses!A:Z"; // onglet/range à adapter

function sheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GSVC_CLIENT_EMAIL,
      private_key: (process.env.GSVC_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function normalizeEmail(s: string): string {
  return (s || "").trim().toLowerCase();
}

function parseFrenchDateTime(v: string): Date | null {
  // ex: "29/08/2025 13:37:10"
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [_, dd, mm, yyyy, HH, MM, SS] = m;
  return new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(HH),
    Number(MM),
    Number(SS)
  );
}

function toNumberSafe(v: any): number | undefined {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function normalizeGoalKey(s: string): Profile["goal"] | undefined {
  const x = (s || "").toLowerCase();
  // équivalences FR fréquentes (pdm = prise de masse ; fautes communes)
  if (/(pdm|prise de masse|prise de poids|hypertroph)/.test(x)) return "hypertrophy";
  if (/(perte|secher|poid|gras)/.test(x)) return "fatloss";
  if (/(force)/.test(x)) return "strength";
  if (/(endur)/.test(x)) return "endurance";
  if (/(mobilit|souplesse)/.test(x)) return "mobility";
  if (x) return "general";
  return undefined;
}

function goalLabelFromKey(k?: Profile["goal"]): string | undefined {
  if (!k) return undefined;
  const map: Record<NonNullable<Profile["goal"]>, string> = {
    hypertrophy: "Hypertrophie / Esthétique",
    fatloss: "Perte de gras",
    strength: "Force",
    endurance: "Endurance / Cardio",
    mobility: "Mobilité / Souplesse",
    general: "Forme générale",
  };
  return map[k];
}

/** Lit toutes les lignes et retourne la DERNIÈRE pour un email donné */
export async function getAnswersForEmail(email: string): Promise<RawAnswer | null> {
  const em = normalizeEmail(email);
  if (!em) return null;

  const sheets = sheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rows = (data.values || []) as any[]; // on suppose colonnes: [ts, prenom, age, poids, taille, intensite, objectif, jours, lieu, email, ...]
  if (!rows.length) return null;

  // Cherche toutes les lignes de cet email (colonne email supposée en index 9 = J ; adapte si besoin)
  const matches: RawAnswer[] = [];
  for (const r of rows) {
    const tsStr = String(r[0] || "");
    const ts = parseFrenchDateTime(tsStr) || new Date(tsStr || Date.now());
    const prenom = (r[1] || "").toString().trim();
    const age = toNumberSafe(r[2]);
    const intensite = (r[5] || "").toString().trim();
    const objectifBrut = (r[6] || "").toString().trim();
    const jours = (r[7] || "").toString().trim();
    const lieu = (r[8] || "").toString().trim();
    const mail = normalizeEmail(r[9] || "");

    if (mail && mail === em) {
      matches.push({ ts, prenom, age, intensite, objectifBrut, jours, lieu, email: mail });
    }
  }

  if (matches.length === 0) return null;

  // Trie par date croissante et prend la dernière
  matches.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  return matches[matches.length - 1];
}

/** Construit le Profile à partir de la dernière réponse */
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
