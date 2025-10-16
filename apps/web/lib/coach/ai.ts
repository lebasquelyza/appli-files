// app/lib/coach/ai.ts

import "server-only"; // garantit un usage côté serveur sans transformer tout en Server Action


/**
 * Module serveur : construit des séances personnalisées à partir de l'API
 * (si dispo) ou, à défaut, à partir des réponses Google Sheets + règles.
 * ❗ API de surface inchangée pour ne rien casser côté app.
 */

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
  date: string; // YYYY-MM-DD
  plannedMin?: number;
  note?: string;
  intensity?: "faible" | "modérée" | "élevée";
  recommendedBy?: string;
  exercises?: NormalizedExercise[];
  blocks?: { name: "echauffement" | "principal" | "fin" | "accessoires"; items: NormalizedExercise[] }[];
  plan?: any;
  content?: any;
};
export type AiProgramme = { sessions: AiSession[] };

export type Answers = Record<string, string>;
export type Goal = "hypertrophy" | "fatloss" | "strength" | "endurance" | "mobility" | "general";
export type SubGoal =
  | "glutes" | "legs" | "chest" | "back" | "arms" | "shoulders"
  | "posture" | "core" | "rehab";
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
  freq: number;                // séances / semaine
  timePerSession: number;      // minutes
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
const API_BASE = process.env.FILES_COACHING_API_BASE || "https://files-coaching.com";
const API_KEY  = process.env.FILES_COACHING_API_KEY || "";
const SHEET_ID    = process.env.SHEET_ID    || "1XH-BOUj4tXAVy49ONBIdLiWM97hQ-Fg8h5-OTRGvHC4";
const SHEET_RANGE = process.env.SHEET_RANGE || "Réponses!A1:K";
const SHEET_GID   = process.env.SHEET_GID   || "1160551014";

/* ===================== Utils ===================== */
export function norm(s: string) {
  // Normalise accents/ponctuation/espaces et rend en minuscule
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques
    .replace(/œ/g, "oe")
    .replace(/ç/g, "c")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function readNum(s: string): number | undefined {
  // Gère "1,75", "1.75", "1,75 m", "75kg"
  const cleaned = String(s).replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/* ===================== Google Sheets (CSV public) ===================== */
async function fetchValues(sheetId: string, range: string) {
  const sheetName = (range.split("!")[0] || "").replace(/^'+|'+$/g, "");
  if (!sheetId) throw new Error("SHEETS_CONFIG_MISSING");

  const tries: string[] = [];
  if (SHEET_GID) {
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=${encodeURIComponent(SHEET_GID)}`);
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(SHEET_GID)}`);
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${encodeURIComponent(SHEET_GID)}`);
  }
  if (sheetName) {
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);
  }

  for (const url of tries) {
    const res = await fetch(url, { cache: "no-store" });
    const lastCT = res.headers.get("content-type") || "";
    const text = await res.text().catch(() => "");
    if (!res.ok) continue;

    // Évite les pages HTML d’erreur/consentement
    const looksHtml = text.trim().startsWith("<") || lastCT.includes("text/html");
    if (looksHtml) continue;

    // Parser CSV minimaliste (gère guillemets et virgules dans les champs)
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    for (const line of lines) {
      const cells: string[] = [];
      let cur = "", inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === "," && !inQuotes) {
          cells.push(cur); cur = "";
        } else {
          cur += ch;
        }
      }
      cells.push(cur);
      rows.push(cells.map(c => c.trim().replace(/^"|"$/g, "")));
    }
    return { values: rows };
  }
  throw new Error("SHEETS_FETCH_FAILED");
}

const NO_HEADER_COLS = { nom: 0, prenom: 1, age: 2, email: 10 };

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
  const hasHeader = firstRowNorm.some(h => headerCandidates.includes(h));

  let headers: string[] = [];
  let idxEmail = -1;

  if (hasHeader) {
    headers = firstRowNorm;
    idxEmail = headers.findIndex(h => headerCandidates.includes(h));
  } else {
    const width = Math.max(values[0]?.length || 0, NO_HEADER_COLS.email + 1);
    headers = Array.from({ length: width }, (_, i) => `col${i}`);
    headers[NO_HEADER_COLS.nom]    = "nom";
    headers[NO_HEADER_COLS.prenom] = "prenom";
    headers[NO_HEADER_COLS.age]    = "age";
    headers[NO_HEADER_COLS.email]  = "email";
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
      // Champs minimaux
      rec["nom"]    = rec["nom"]    || rec[`col${NO_HEADER_COLS.nom}`]    || "";
      rec["prenom"] = rec["prenom"] || rec[`col${NO_HEADER_COLS.prenom}`] || "";
      rec["age"]    = rec["age"]    || rec[`col${NO_HEADER_COLS.age}`]    || "";
      rec["email"]  = rec["email"]  || rec[`col${NO_HEADER_COLS.email}`]  || "";
      return rec;
    }
  }
  return null;
}

/* ===================== Parsing profil & règles ===================== */
function classifyGoal(raw: string): Goal {
  const s = norm(raw);
  if (/(prise|hypertroph|volume|masse|muscle|bodybuild|construction)/.test(s)) return "hypertrophy";
  if (/(tonifi|galb|se dessiner|shape|esthetique|esthetique)/.test(s)) return "hypertrophy";
  if (/(perte|mince|sech|seche|gras|poids|cut|dry|recomp|affiner|affinage)/.test(s)) return "fatloss";
  if (/(force|1rm|5x5|3x5|power|puissance|max strength|halterophil|weightlifting)/.test(s)) return "strength";
  if (/(endurance|cardio|marathon|semi|trail|tri|velo|cycl|rameur|row|course|running|footing|z2|intervalles)/.test(s)) return "endurance";
  if (/(endurance musculaire|metcon|wod|crossfit)/.test(s)) return "endurance";
  if (/(mobilit|souplesse|etirement|etire|douleur|rehab|reeduc|posture)/.test(s)) return "mobility";
  return "general";
}
function detectSubGoals(raw: string): SubGoal[] {
  const s = norm(raw); const out: SubGoal[] = [];
  if (/(fessier|glute|booty)/.test(s)) out.push("glutes");
  if (/(cuisse|jambe|quadri|ischio)/.test(s)) out.push("legs");
  if (/(pec|poitrine|chest)/.test(s)) out.push("chest");
  if (/(dos|lats|trap|rowing)/.test(s)) out.push("back");
  if (/(bras|biceps|triceps)/.test(s)) out.push("arms");
  if (/(epaul|delto)/.test(s)) out.push("shoulders");
  if (/(posture|mobilite|souplesse)/.test(s)) out.push("posture");
  if (/(abdo|core|gainage)/.test(s)) out.push("core");
  if (/(rehab|reeduc|douleur)/.test(s)) out.push("rehab");
  return Array.from(new Set(out));
}
function parseLevel(raw: string): Profile["level"] {
  const s = norm(raw);
  if (/(debut)/.test(s)) return "debutant";
  if (/(inter)/.test(s)) return "intermediaire";
  if (/(avance|expert|confirm)/.test(s)) return "avance";
  return "intermediaire";
}
function parseFreq(raw: string): number {
  const s = norm(raw);
  const digits = s.match(/\d+/g);
  if (digits?.length) return Math.max(1, Math.min(6, parseInt(digits[0], 10)));
  if (/(lun|mar|mer|jeu|ven|sam|dim)/.test(s)) {
    const nb = s.split(/[ ,;\/-]+/).filter(Boolean).length;
    return Math.max(1, Math.min(6, nb));
  }
  return 3;
}
function parseTimePerSession(raw: string): number {
  const s = norm(raw);
  const hMatch = s.match(/(\d+)\s*h(?:\s*(\d+))?/);           // "1h" ou "1h 15"
  const minMatch = s.match(/(\d{2,3})\s*(?:min|m)\b/);       // "45min"
  if (hMatch) {
    const h = parseInt(hMatch[1], 10);
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    return Math.max(20, Math.min(120, h * 60 + m));
  }
  if (minMatch) return Math.max(20, Math.min(120, parseInt(minMatch[1], 10)));
  if (/(court|rapide|express)/.test(s)) return 25;
  if (/(long|complet)/.test(s)) return 60;
  return 45;
}
function inferEquipment(materiel: string, lieu: string) {
  const m = norm(materiel); const l = norm(lieu);
  const isBox = /(crossfit|cross|wod|emom|amrap|box)/.test(l);
  const gym = /(salle|gym|fitness|basic-fit|keepcool|neo|temple|cmg|fitness park)/.test(l);
  if (isBox) return { level: "limited" as const, items: ["barre","kettlebell","halteres","corde","anneaux/TRX"], gym: true, location: "box" as const, likesWOD: true };
  if (gym) return { level: "full" as const, items: ["barre","rack","machines","halteres","cables"], gym: true, location: "gym" as const, likesWOD: false };
  if (/(aucun|rien|sans|poids du corps|bodyweight|pb)/.test(m) || m === "") {
    return { level: "none" as const, items: [], gym: false, location: /(exter|dehors|outdoor|parc)/.test(l) ? "outdoor" as const : "home" as const, likesWOD: false };
  }
  const items: string[] = [];
  if (/(halter|haltere|dumbbell|db)/.test(m)) items.push("halteres");
  if (/(kettlebell|kettle|kb)/.test(m)) items.push("kettlebell");
  if (/(elastique|bande|band)/.test(m)) items.push("elastiques");
  if (/(barre)/.test(m)) items.push("barre");
  if (/(rack)/.test(m)) items.push("rack");
  if (/(banc)/.test(m)) items.push("banc");
  if (/(trx|anneaux)/.test(m)) items.push("TRX/anneaux");
  return { level: "limited" as const, items, gym: false, location: /(exter|dehors|outdoor|parc)/.test(l) ? "outdoor" as const : "home" as const, likesWOD: false };
}
function detectCardioPref(raw: string): Profile["cardioPref"] {
  const s = norm(raw);
  if (/(course|run|footing|tapis)/.test(s)) return "run";
  if (/(velo|bike|spinning)/.test(s)) return "bike";
  if (/(rameur|row)/.test(s)) return "row";
  if (/(marche|step)/.test(s)) return "walk";
  return "mixed";
}
function detectInjuries(raw: string): string[] {
  const s = norm(raw); const out: string[] = [];
  if (/(epaule|epaules|coiffe)/.test(s)) out.push("epaules");
  if (/(genou|genoux|patella|menisque)/.test(s)) out.push("genoux");
  if (/(dos|lombaire|hernie|sciatique)/.test(s)) out.push("dos");
  if (/(cheville|tendon|tendinite|achille)/.test(s)) out.push("chevilles/tendons");
  return out;
}

export function buildProfileFromAnswers(ans: Answers): Profile {
  const get = (k: string) => ans[norm(k)] || ans[k] || "";

  const email = get("email") || get("adresse mail") || get("e-mail") || get("mail");
  const prenom = get("prenom") || get("prénom") || "";
  const age = readNum(get("age"));
  const poids = readNum(get("poids"));
  const taille = readNum(get("taille"));
  const imc = poids && taille ? Math.round((poids / Math.pow(taille/100, 2)) * 10) / 10 : undefined;

  const objectif =
    get("objectif") ||
    get("objectif principal") ||
    get("ton objectif") ||
    get("ton objectif principal") ||
    get("objectif sportif") ||
    get("but") ||
    get("but principal") ||
    "";

  const sousObj  = get("zones a travailler") || get("zones à travailler") || "";
  const niveau   = get("niveau") || "";
  const dispo    = get("disponibilite") || get("disponibilité") || "";
  const temps    = get("temps par seance") || get("temps par séance") || "";
  const lieu     = get("a quel endroit v tu faire ta seance ?") || get("lieu") || "";
  const materiel = get("as tu du materiel a ta disposition") || get("as tu du matériel a ta disposition") || "";
  const cardio   = get("cardio prefere") || get("cardio préféré") || get("preference cardio") || "";
  const bless    = get("blessures") || get("douleurs") || "";
  const sommeil  = get("sommeil") || "";
  const stress   = get("stress") || "";

  const goal = classifyGoal(objectif || sousObj);
  const subGoals = detectSubGoals(objectif + " " + sousObj);
  const level = parseLevel(niveau);
  const freq = parseFreq(dispo);
  const timePerSession = parseTimePerSession(temps);
  const equip = inferEquipment(materiel, lieu);
  const cardioPref = detectCardioPref(cardio);
  const injuries = detectInjuries(bless);

  let finalGoal: Goal = goal;
  if (finalGoal === "general") {
    if (/(wod|crossfit|metcon|emom|amrap)/.test(norm(objectif))) finalGoal = "endurance";
    else if (subGoals.some(sg => ["glutes","legs","chest","back","arms","shoulders"].includes(sg))) finalGoal = "hypertrophy";
    else if (detectCardioPref(objectif) !== "mixed") finalGoal = "endurance";
    else if (/(mobilit|souplesse|douleur|rehab|reeduc|posture)/.test(norm(bless))) finalGoal = "mobility";
  }

  return {
    email: email || "",
    prenom: prenom || undefined,
    age: typeof age === "number" ? age : undefined,
    height: taille, weight: poids, imc,
    goal: finalGoal,
    subGoals, level, freq, timePerSession,
    equipLevel: equip.level, equipItems: equip.items, gym: equip.gym, location: equip.location as any,
    cardioPref, injuries,
    sleepOk: /(bien|ok|correct)/.test(norm(sommeil)) || undefined,
    stressHigh: /(eleve|eleve|haut)/.test(norm(stress)) || undefined,
    likesWOD: (equip as any).likesWOD || false,
  };
}

/* ===================== Titre, durée, intensité ===================== */
function titleForSession(profile: Profile, i: number): { title: string; type: WorkoutType } {
  const g = profile.goal;
  const has = (sg: SubGoal) => profile.subGoals.includes(sg);

  if (g === "hypertrophy") {
    const poolGym = [
      has("glutes") ? "[Hypertrophie] Bas GLUTES (Gym)" : "[Hypertrophie] Bas (Gym)",
      has("chest")  ? "[Hypertrophie] Haut PEC (Gym)"   : "[Hypertrophie] Haut (Gym)",
      "[Hypertrophie] Full Body (Machines)",
    ];
    const poolLimited = [
      has("glutes") ? "[Hypertrophie] Bas GLUTES (DB)" : "[Hypertrophie] Bas (DB)",
      has("chest")  ? "[Hypertrophie] Haut PEC (DB)"   : "[Hypertrophie] Haut (DB)",
      "[Hypertrophie] Full Body (DB/Élastiques)",
    ];
    const poolNone = [
      has("glutes") ? "[Hypertrophie] GLUTES (PB)" : "[Hypertrophie] Full Body (PB)",
      "[Hypertrophie] Haut (PB)",
      "[Hypertrophie] Bas (PB)",
    ];
    const arr = profile.equipLevel === "full" ? poolGym : profile.equipLevel === "limited" ? poolLimited : poolNone;
    return { title: arr[i % arr.length], type: "muscu" };
  }

  if (g === "strength") {
    const arr = profile.equipLevel === "full"
      ? ["[Force] Bas 5×5 (Barre)", "[Force] Haut 5×5 (Barre)", "[Force] Full 3×5"]
      : ["[Force] Bas (DB/KB)", "[Force] Haut (DB)", "[Force] Full (DB)"];
    return { title: arr[i % arr.length], type: "muscu" };
  }

  if (g === "fatloss") {
    const arr = profile.equipLevel === "none"
      ? ["[Fatloss] HIIT 30/30 (PB)", "[Fatloss] Circuit PB", "[Fatloss] Z2 Marche active"]
      : ["[Fatloss] Intervalles", "[Fatloss] Circuit Full Body", "[Fatloss] Z2 + Core"];
    return { title: arr[i % arr.length], type: profile.equipLevel === "none" ? "hiit" : "muscu" };
  }

  if (g === "endurance") {
    const pref = profile.cardioPref;
    if (pref === "bike") return { title: "[Endurance] Vélo Z2 + 4×4", type: "cardio" };
    if (pref === "row")  return { title: "[Endurance] Rameur Z2 + 4×4", type: "cardio" };
    if (pref === "walk") return { title: "[Endurance] Marche active Z2", type: "cardio" };
    return { title: ["[Endurance] Zone 2", "[Endurance] Intervalles 4×4", "[Endurance] Tempo"][i % 3], type: "cardio" };
  }

  if (g === "mobility") {
    const arr = ["[Mobilité] Hanches & Colonne", "[Mobilité] Épaules & T-spine", "[Mobilité] Full Body"];
    return { title: arr[i % arr.length], type: "mobilité" };
  }

  const arr = profile.equipLevel === "none"
    ? ["[Général] PB A", "[Général] PB B", "[Général] Cardio Z2 (PB)"]
    : ["[Général] Full Body A", "[Général] Full Body B", "[Général] Z2 + Core"];
  return { title: arr[i % arr.length], type: "muscu" };
}

function intensityFor(p: Profile): "faible" | "modérée" | "élevée" {
  if (p.goal === "mobility") return "faible";
  if (p.goal === "strength" || p.goal === "hypertrophy") return p.level === "avance" ? "élevée" : "modérée";
  if (p.goal === "fatloss") return "modérée";
  if (p.goal === "endurance") return "modérée";
  return "modérée";
}

function durationFor(p: Profile): number {
  let d = p.timePerSession || 45;
  if (p.goal === "strength") d = Math.max(d, 55);
  if (p.goal === "mobility") d = Math.min(d, 35);
  if (p.goal === "fatloss" && d < 35) d = 35;
  if (typeof p.age === "number" && p.age >= 55) d = Math.min(d, 55);
  return Math.max(25, Math.min(90, d));
}

/* ===================== Bibliothèque d’exos & sécurité ===================== */
const EXOS = {
  pb: {
    squat:      { name:"Squat au poids du corps", reps:"12-15", sets:3, rest:"60s",  equipment:"PB",     target:"cuisses/fessiers" },
    hipThrust:  { name:"Hip Thrust au sol",       reps:"12-15", sets:3, rest:"60s",  equipment:"PB",     target:"fessiers" },
    pushup:     { name:"Pompes",                  reps:"8-12",  sets:3, rest:"75s",  equipment:"PB",     target:"pecs/épaules/triceps", alt:"Pompes sur les genoux" },
    rowInverted:{ name:"Rowing inversé table/TRX",reps:"8-12",  sets:3, rest:"75s",  equipment:"PB",     target:"dos", alt:"Row élastique" },
    plank:      { name:"Gainage planche",         durationSec:40, sets:3, rest:"45s",equipment:"PB",     target:"core" },
    lunge:      { name:"Fentes marchées",         reps:"10/10", sets:3, rest:"60s",  equipment:"PB",     target:"cuisses/fessiers" },
    burpee:     { name:"Burpees",                 reps:"10-12", sets:4, rest:"45s",  equipment:"PB",     target:"full/hiit" },
  },
  db: {
    goblet:       { name:"Goblet Squat (DB/KB)",       reps:"8-12", sets:4, rest:"90s", equipment:"DB/KB", target:"cuisses/fessiers" },
    rdl:          { name:"Romanian Deadlift (DB)",     reps:"8-12", sets:4, rest:"90s", equipment:"DB",    target:"ischios/fessiers" },
    bench:        { name:"Développé couché haltères",  reps:"8-12", sets:4, rest:"90s", equipment:"DB",    target:"pecs" },
    ohp:          { name:"Développé épaules (DB)",     reps:"8-12", sets:3, rest:"90s", equipment:"DB",    target:"épaules" },
    row:          { name:"Row haltère unilatéral",     reps:"10/10",sets:4, rest:"75s", equipment:"DB",    target:"dos" },
    curl:         { name:"Curl biceps (DB)",           reps:"10-12",sets:3, rest:"60s", equipment:"DB",    target:"bras" },
    triceps:      { name:"Extensions triceps (DB)",    reps:"10-12",sets:3, rest:"60s", equipment:"DB",    target:"bras" },
    bandFacePull: { name:"Face Pull (élastique)",      reps:"12-15",sets:3, rest:"60s", equipment:"Band",  target:"haut du dos" },
  },
  gym: {
    backSquat: { name:"Back Squat (barre)",  reps:"5×5", sets:5, rest:"120s", equipment:"Barre/Rack", target:"cuisses/fessiers", tempo:"30X1", rir:2 },
    deadlift:  { name:"Soulevé de terre",    reps:"3×5", sets:3, rest:"180s", equipment:"Barre",      target:"chaîne postérieure", rir:2 },
    bench:     { name:"Développé couché",    reps:"5×5", sets:5, rest:"120s", equipment:"Barre",      target:"pecs", rir:2 },
    pull:      { name:"Tractions (assistées si besoin)", reps:"6-8", sets:4, rest:"120s", equipment:"Barre fixe", target:"dos" },
    legPress:  { name:"Presse à cuisses",    reps:"10-12",sets:4, rest:"90s", equipment:"Machine",    target:"cuisses" },
    cableRow:  { name:"Row poulie",          reps:"10-12",sets:4, rest:"75s", equipment:"Poulie",     target:"dos" },
  },
  wod: {
    emom: (min=12)=> ({ name:`EMOM ${min}'`, sets:1, reps:`Tour/minute`, rest:"—", notes:"Alt: 1) 12 KBS, 2) 10 Burpees, 3) 15 Air Squats", equipment:"KB/PB", target:"metcon" }),
    amrap:(min=12)=> ({ name:`AMRAP ${min}'`,sets:1, reps:"Rondes max",  rest:"—", notes:"10 DB Thrusters · 10 Sit-ups · 10 Box Step-ups", equipment:"DB/PB", target:"metcon" }),
    intervalsRun: { name:"Course 4×4' Z4 (récup 3')", sets:4, durationSec:240, rest:"180s", equipment:"Running", target:"cardio" },
  },
  mobility: {
    "90_90":  { name:"90/90 hanches",                  durationSec:45, sets:2, rest:"20s", target:"mobilité" },
    catCow:   { name:"Cat-Cow",                        durationSec:60, sets:2, rest:"20s", target:"mobilité" },
    thoracic: { name:"Ouvertures T-spine",             durationSec:45, sets:2, rest:"20s", target:"mobilité" },
    doorway:  { name:"Étirement pectoraux à l’embrasure", durationSec:45, sets:2, rest:"20s", target:"mobilité" },
  },
} as const;

function safe(ex: NormalizedExercise, injuries: string[]): NormalizedExercise | null {
  const n = norm(ex.name);
  if (injuries.includes("genoux")  && /(squat|fente|press)/.test(n)) return null;
  if (injuries.includes("epaules") && /(developpe|overhead|ohp|traction)/.test(n)) return null;
  if (injuries.includes("dos")     && /(souleve|deadlift|row)/.test(n)) return null;
  return ex;
}

/* ===================== Construction des blocs ===================== */
function buildSessionBlocks(profile: Profile, kind: { title: string; type: WorkoutType }, plannedMin: number) {
  const warmup: NormalizedExercise[] = [];
  const main: NormalizedExercise[] = [];
  const fin: NormalizedExercise[] = [];
  const acc: NormalizedExercise[] = [];

  // 1) Échauffement
  warmup.push({ name:"Mobilité dynamique bas/haut", durationSec:300, rest:"—", block:"echauffement", notes:"chevilles, hanches, T-spine" });
  if (profile.goal !== "mobility") {
    warmup.push({ name:"Activation core (Deadbug)", durationSec:120, rest:"30s", block:"echauffement" });
  }

  // 2) Principal
  const addSafe = (e?: NormalizedExercise | null) => { if (e) main.push({ ...e, block:"principal" }); };
  const addSafeAcc = (e?: NormalizedExercise | null) => { if (e) acc.push({ ...e, block:"accessoires" }); };
  const I = profile.injuries;

  if (profile.location === "box" || profile.likesWOD) {
    addSafe(EXOS.wod.emom(12));
    addSafe(EXOS.wod.amrap(10));
    fin.push({ name:"Finisher corde à sauter", durationSec:300, rest:"—", block:"fin", notes:"30\" on / 30\" off" });
  } else if (profile.equipLevel === "full") {
    if (/Haut/i.test(kind.title)) {
      addSafe(safe(EXOS.gym.bench, I)); addSafe(safe(EXOS.gym.pull, I)); addSafe(safe(EXOS.gym.cableRow, I));
      addSafeAcc(safe(EXOS.db.bandFacePull as any, I)); addSafeAcc(safe(EXOS.db.curl as any, I)); addSafeAcc(safe(EXOS.db.triceps as any, I));
    } else if (/Bas/i.test(kind.title)) {
      addSafe(safe(EXOS.gym.backSquat, I)); addSafe(safe(EXOS.gym.legPress, I)); addSafe(safe(EXOS.gym.deadlift, I));
    } else {
      addSafe(safe(EXOS.gym.backSquat, I)); addSafe(safe(EXOS.gym.bench, I)); addSafe(safe(EXOS.gym.cableRow, I));
    }
  } else if (profile.equipLevel === "limited") {
    addSafe(safe(EXOS.db.goblet as any, I));
    addSafe(safe(EXOS.db.row as any, I));
    addSafe(safe(EXOS.db.bench as any, I));
    addSafeAcc(safe(EXOS.db.rdl as any, I));
    addSafeAcc(safe(EXOS.db.bandFacePull as any, I));
  } else {
    // Sans matériel
    if (kind.type === "hiit" || /HIIT|Circuit/i.test(kind.title)) {
      addSafe(safe(EXOS.pb.burpee, I)); addSafe(safe(EXOS.pb.rowInverted, I)); addSafe(safe(EXOS.pb.lunge, I)); addSafe(safe(EXOS.pb.pushup, I));
      fin.push({ name:"Sprint 6×20\" (récup 100\")", sets:6, durationSec:20, rest:"100s", block:"fin", target:"cardio" });
    } else {
      addSafe(safe(EXOS.pb.squat, I)); addSafe(safe(EXOS.pb.pushup, I)); addSafe(safe(EXOS.pb.rowInverted, I));
      addSafeAcc(safe(EXOS.pb.hipThrust, I)); addSafeAcc(safe(EXOS.pb.plank, I));
    }
  }

  // 3) Fin si rien ajouté
  if (fin.length === 0) {
    if (profile.goal === "mobility") {
      const a = EXOS.mobility["90_90"];
      const b = EXOS.mobility.doorway;
      if (a) fin.push({ ...a, block: "fin" });
      if (b) fin.push({ ...b, block: "fin" });
    } else {
      fin.push({ name: "Stretching léger full body", durationSec: 300, rest: "—", block: "fin" });
    }
  }

  // 4) Ajustement durée (on coupe les accessoires si trop long,
  //    puis on ajoute du temps de cardio facile si trop court)
  const approxTime = (arr: NormalizedExercise[]) =>
    arr.reduce((t, e) => t + (e.durationSec ? e.durationSec * (e.sets || 1) : (e.sets || 3) * 60), 0);

  const targetSec = plannedMin * 60;
  let totalSec = approxTime(warmup) + approxTime(main) + approxTime(fin) + approxTime(acc);

  // Trop long → retirer accessoires
  while (totalSec > targetSec && acc.length) {
    acc.pop();
    totalSec = approxTime(warmup) + approxTime(main) + approxTime(fin) + approxTime(acc);
  }

  // Trop court → ajouter marche Z2 (cooldown actif)
  if (totalSec < targetSec - 120 && profile.goal !== "mobility") {
    const missing = targetSec - totalSec;
    const addMin = Math.min(10 * 60, Math.max(180, missing)); // 3' à 10'
    fin.push({ name:"Marche Z2 / Récup active", durationSec:addMin, rest:"—", block:"fin", target:"cardio" });
  }

  return [
    { name:"echauffement" as const, items: warmup },
    { name:"principal" as const,    items: main },
    { name:"accessoires" as const,  items: acc },
    { name:"fin" as const,          items: fin },
  ];
}

/* ===================== Génération ===================== */
export function generateProgrammeFromAnswers(ans: Answers): AiSession[] {
  const p = buildProfileFromAnswers(ans);
  const nb = Math.max(1, Math.min(6, p.freq));
  const planned = durationFor(p);
  const intens = intensityFor(p);
  const out: AiSession[] = [];
  const today = new Date();

  for (let i = 0; i < nb; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i * Math.ceil(7 / nb));
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), da = String(d.getDate()).padStart(2,"0");

    const kind = titleForSession(p, i);
    const notes: string[] = [];
    if (p.gym) notes.push(p.location === "box" ? "Box : format WOD" : "Salle : accès machines/barres");
    if (p.equipLevel === "limited") notes.push(`Matériel : ${p.equipItems.join(", ") || "quelques charges"}`);
    if (p.equipLevel === "none") notes.push("Sans matériel");
    if (p.injuries.length) notes.push(`Prudence : ${p.injuries.join(", ")}`);
    if (p.imc) notes.push(`IMC: ${p.imc}`);

    const blocks = buildSessionBlocks(p, kind, planned);
    const exercises = blocks.flatMap(b => b.items);

    out.push({
      id: `rule-${p.goal}-${p.equipLevel}-${y}${m}${da}-${i}`,
      title: kind.title,
      type: kind.type,
      date: `${y}-${m}-${da}`,
      plannedMin: planned,
      intensity: intens,
      note: notes.join(" · "),
      recommendedBy: "Coach Files (règles)",
      blocks,
      exercises,
    });
  }
  return out;
}

/* ===================== Fetch depuis API ou fallback règles ===================== */
export async function fetchAiProgramme(getSignedInEmail: () => Promise<string>): Promise<AiProgramme | null> {
  const uidFromCookie = cookies().get("fc_uid")?.value;
  const uid = uidFromCookie || "me";

  const endpoints = [
    `${API_BASE}/api/programme?user=${encodeURIComponent(uid)}`,
    `${API_BASE}/api/program?user=${encodeURIComponent(uid)}`,
    `${API_BASE}/api/sessions?source=ai&user=${encodeURIComponent(uid)}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) },
        cache: "no-store",
      });
      if (!res.ok) continue;

      const data = (await res.json()) as any;
      const raw = Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data) ? data : [];
      if (!raw.length) continue;

      const sessions: AiSession[] = raw.map((r: any, i: number) => ({
        id: String(r.id ?? `ai-${i}`),
        title: String(r.title ?? r.name ?? "Séance personnalisée"),
        type: (r.type ?? r.category ?? "muscu") as WorkoutType,
        date: String(r.date ?? r.day ?? r.when ?? new Date().toISOString().slice(0, 10)),
        plannedMin: typeof r.plannedMin === "number" ? r.plannedMin : typeof r.duration === "number" ? r.duration : undefined,
        note: typeof r.note === "string" ? r.note : typeof r.notes === "string" ? r.notes : undefined,
        intensity: r.intensity as any,
        recommendedBy: r.recommendedBy ?? r.model ?? "Coach Files",
        exercises: Array.isArray(r.exercises) ? r.exercises : undefined,
        blocks: Array.isArray(r.blocks) ? r.blocks : undefined,
        plan: r.plan, content: r.content,
      }));
      return { sessions };
    } catch {
      // on tente l’endpoint suivant
    }
  }

  // Fallback : moteur de règles via questionnaire Sheets
  try {
    const detectedEmail = await getSignedInEmail();
    const emailFromCookie = cookies().get("app_email")?.value || "";
    const email = detectedEmail || emailFromCookie;
    if (email) {
      const ans = await getAnswersForEmail(email, SHEET_ID, SHEET_RANGE);
      if (ans) return { sessions: generateProgrammeFromAnswers(ans) };
    }
  } catch {}
  return null;
}

/* ===================== WRAPPERS DE CONFORT (compat) ===================== */
// Source d’email par défaut (cookie "app_email")
async function getSignedInEmailDefault(): Promise<string> {
  return cookies().get("app_email")?.value || "";
}

/** Renvoie directement un tableau de séances IA */
export async function getAiSessions(): Promise<AiSession[]> {
  const prog = await fetchAiProgramme(getSignedInEmailDefault);
  return prog?.sessions ?? [];
}

/** Renvoie { sessions } — pratique pour l’import default */
export async function getProgrammeForUser(): Promise<AiProgramme | null> {
  const prog = await fetchAiProgramme(getSignedInEmailDefault);
  return prog ?? { sessions: [] };
}

// Alias compat pour pages qui utiliseraient d’autres noms :
export const generateProgrammeForUser = getProgrammeForUser;
export const buildProgrammeForUser = getProgrammeForUser;
export const generateProgramme = getProgrammeForUser;

/** Export par défaut : { sessions } */
export default getProgrammeForUser;
