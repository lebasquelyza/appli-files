/* ============ BLOC 1/4 — Imports, Types, Config, Auth ============ */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ===================== Types ===================== */
type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";
type WorkoutStatus = "active" | "done";

type NormalizedExercise = {
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

type Workout = {
  id: string;
  title: string;
  type: WorkoutType;
  status: WorkoutStatus;
  date: string;
  plannedMin?: number;
  startedAt?: string;
  endedAt?: string;
  note?: string;
  createdAt: string;
  exercises?: NormalizedExercise[];
};

type Store = { sessions: Workout[] };

type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string;
  plannedMin?: number;
  note?: string;
  intensity?: "faible" | "modérée" | "élevée";
  recommendedBy?: string;
  exercises?: NormalizedExercise[];
  blocks?: { name: "echauffement" | "principal" | "fin" | "accessoires"; items: NormalizedExercise[] }[];
  plan?: any;
  content?: any;
};
type AiProgramme = { sessions: AiSession[] };

/* ===================== Config ===================== */
const API_BASE = process.env.FILES_COACHING_API_BASE || "https://files-coaching.com";
const API_KEY  = process.env.FILES_COACHING_API_KEY || "";
const SHEET_ID    = process.env.SHEET_ID    || "1XH-BOUj4tXAVy49ONBIdLiWM97hQ-Fg8h5-OTRGvHC4";
const SHEET_RANGE = process.env.SHEET_RANGE || "Réponses!A1:K";
const SHEET_GID   = process.env.SHEET_GID   || "1160551014";
const QUESTIONNAIRE_BASE = process.env.FILES_COACHING_QUESTIONNAIRE_BASE || "https://questionnaire.files-coaching.com";

/* ===================== Auth ===================== */
async function getSignedInEmail(): Promise<string> {
  try {
    // @ts-ignore
    const { getServerSession } = await import("next-auth");
    // @ts-ignore
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions as any);
    const email = (session as any)?.user?.email as string | undefined;
    if (email) return email;
  } catch {}
  return cookies().get("app_email")?.value || "";
}
/* ============ BLOC 2/4 — Utils + Profil + Moteur de règles + Bibliothèque d’exos ============ */

/* ===================== Utils ===================== */
function parseStore(val?: string | null): Store {
  if (!val) return { sessions: [] };
  try { const o = JSON.parse(val!); if (Array.isArray(o?.sessions)) return { sessions: o.sessions as Workout[] }; } catch {}
  return { sessions: [] };
}
function fmtDateISO(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("fr-FR", { year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" });
    }
  } catch {}
  return iso || "—";
}
function fmtDateYMD(ymd?: string) {
  if (!ymd) return "—";
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("fr-FR", { year:"numeric", month:"long", day:"numeric" });
  } catch {}
  return ymd;
}
function typeBadgeClass(t: WorkoutType) {
  switch (t) {
    case "muscu": return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "cardio": return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "hiit":  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "mobilité": return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }
}
function clampOffset(total: number, take: number, offset: number) {
  if (total <= 0) return { offset: 0, emptyReason: "none" as const };
  if (offset >= total) return { offset: Math.max(0, Math.ceil(total / take) * take - take), emptyReason: "ranout" as const };
  return { offset, emptyReason: "none" as const };
}

/* ======== Google Sheets (CSV public) ======== */
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
    if (res.ok) {
      const looksHtml = text.trim().startsWith("<") || lastCT.includes("text/html");
      if (looksHtml) continue;

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
            cells.push(cur.trim()); cur = "";
          } else {
            cur += ch;
          }
        }
        cells.push(cur.trim());
        rows.push(cells.map(c => c.replace(/^"|"$/g, "")));
      }
      return { values: rows };
    }
  }
  throw new Error("SHEETS_FETCH_FAILED");
}

/* ======== Normalisation / Moteur de règles ======== */
type Answers = Record<string, string>;
function norm(s: string) {
  return s.trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a").replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u").replace(/[’']/g, "'");
}

type Goal = "hypertrophy" | "fatloss" | "strength" | "endurance" | "mobility" | "general";
type SubGoal =
  | "glutes" | "legs" | "chest" | "back" | "arms" | "shoulders"
  | "posture" | "core" | "rehab";
type EquipLevel = "full" | "limited" | "none";

type Profile = {
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

function readNum(s: string): number | undefined {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
function classifyGoal(raw: string): Goal {
  const s = norm(raw);
  if (/(prise|muscle|hypertroph|volume|masse)/.test(s)) return "hypertrophy";
  if (/(perte|mince|seche|gras|poids|fat)/.test(s)) return "fatloss";
  if (/(force|1rm|5x5|power)/.test(s)) return "strength";
  if (/(endurance|cardio|marathon|vélo|velo|trail|tri)/.test(s)) return "endurance";
  if (/(mobilite|souplesse|douleur|recup|rehab)/.test(s)) return "mobility";
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
  if (/(lun|mar|mer|jeu|ven|sam|dim)/.test(s)) return Math.max(1, Math.min(6, s.split(/[ ,;\/-]+/).filter(Boolean).length));
  return 3;
}
function parseTimePerSession(raw: string): number {
  const s = norm(raw);
  const mins = s.match(/\b(\d{2,3})\s*(?:min|m)\b/);
  if (mins) return Math.max(20, Math.min(120, parseInt(mins[1], 10)));
  if (/(court|rapide|express)/.test(s)) return 25;
  if (/(long|complet)/.test(s)) return 60;
  return 45;
}
function inferEquipment(materiel: string, lieu: string) {
  const m = norm(materiel); const l = norm(lieu);
  const isBox = /(crossfit|cross|wod|emom|amrap|box)/.test(l);
  const gym = /(salle|gym|fitness|basic-fit|keepcool|neo|temple)/.test(l);
  if (isBox) return { level: "limited" as const, items: ["barre","kettlebell","haltères","corde","anneaux/TRX"], gym: true, location: "box" as const, likesWOD: true };
  if (gym) return { level: "full" as const, items: ["barre","rack","machines","haltères","câbles"], gym: true, location: "gym" as const, likesWOD: false };
  if (/(aucun|rien|sans)/.test(m) || m === "") return { level: "none" as const, items: [], gym: false, location: /(exter|dehors|outdoor|parc)/.test(l) ? "outdoor" as const : "home" as const, likesWOD: false };
  const items: string[] = [];
  if (/(halter|haltère|dumbbell)/.test(m)) items.push("haltères");
  if (/(kettlebell|kettle)/.test(m)) items.push("kettlebell");
  if (/(elastique|bande)/.test(m)) items.push("élastiques");
  if (/(barre)/.test(m)) items.push("barre");
  if (/(rack)/.test(m)) items.push("rack");
  if (/(banc)/.test(m)) items.push("banc");
  if (/(trx|anneaux)/.test(m)) items.push("TRX/anneaux");
  return { level: "limited" as const, items, gym: false, location: /(exter|dehors|outdoor|parc)/.test(l) ? "outdoor" as const : "home" as const, likesWOD: false };
}
function detectCardioPref(raw: string): Profile["cardioPref"] {
  const s = norm(raw);
  if (/(course|run|footing|tapis)/.test(s)) return "run";
  if (/(velo|vélo|bike|spinning)/.test(s)) return "bike";
  if (/(rameur|row)/.test(s)) return "row";
  if (/(marche|step)/.test(s)) return "walk";
  return "mixed";
}
function detectInjuries(raw: string): string[] {
  const s = norm(raw); const out: string[] = [];
  if (/(epaule|epaules)/.test(s)) out.push("epaules");
  if (/(genou|genoux)/.test(s)) out.push("genoux");
  if (/(dos|lombaire|hernie)/.test(s)) out.push("dos");
  if (/(cheville|tendon|tendinite)/.test(s)) out.push("chevilles/tendons");
  return out;
}

function buildProfileFromAnswers(ans: Answers): Profile {
  const get = (k: string) => ans[norm(k)] || ans[k] || "";

  const email = get("email") || get("adresse mail") || get("e-mail") || get("mail");
  const prenom = get("prénom") || get("prenom") || "";
  const age = readNum(get("age"));
  const poids = readNum(get("poids"));
  const taille = readNum(get("taille"));
  const imc = poids && taille ? Math.round((poids / Math.pow(taille/100, 2)) * 10) / 10 : undefined;

  const objectif = get("objectif");
  const sousObj  = get("zones a travailler") || get("zones à travailler") || "";
  const niveau   = get("niveau") || "";
  const dispo    = get("disponibilité") || get("disponibilite") || "";
  const temps    = get("temps par seance") || get("temps par séance") || "";
  const lieu     = get("a quel endroit v tu faire ta seance ?") || "";
  const materiel = get("as tu du matériel a ta disposition") || get("as tu du materiel a ta disposition") || "";
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

  return {
    email: email || "",
    prenom: prenom || undefined,
    age: typeof age === "number" ? age : undefined,
    height: taille, weight: poids, imc,
    goal, subGoals, level, freq, timePerSession,
    equipLevel: equip.level, equipItems: equip.items, gym: equip.gym, location: equip.location as any,
    cardioPref, injuries,
    sleepOk: /(bien|ok|correct)/.test(norm(sommeil)) || undefined,
    stressHigh: /(eleve|élevé|haut)/.test(norm(stress)) || undefined,
    likesWOD: (equip as any).likesWOD || false,
  };
}

/* ======== Titre & Durée & Intensité ======== */
function titleForSession(profile: Profile, i: number): { title: string; type: WorkoutType } {
  const g = profile.goal;
  const has = (sg: SubGoal) => profile.subGoals.includes(sg);
  if (g === "hypertrophy") {
    const poolGym = [
      has("glutes") ? "[Hypertrophie] Bas GLUTES (Gym)" : "[Hypertrophie] Bas (Gym)",
      has("chest")  ? "[Hypertrophie] Haut PEC (Gym)"   : "[Hypertrophie] Haut (Gym)",
      "[Hypertrophie] Full Body (Machines)"
    ];
    const poolLimited = [
      has("glutes") ? "[Hypertrophie] Bas GLUTES (DB)" : "[Hypertrophie] Bas (DB)",
      has("chest")  ? "[Hypertrophie] Haut PEC (DB)"   : "[Hypertrophie] Haut (DB)",
      "[Hypertrophie] Full Body (DB/Élastiques)"
    ];
    const poolNone = [
      has("glutes") ? "[Hypertrophie] GLUTES (PB)" : "[Hypertrophie] Full Body (PB)",
      "[Hypertrophie] Haut (PB)", "[Hypertrophie] Bas (PB)"
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

/* ======== Bibliothèque d’exos (par matériel / blessure) ======== */
const EXOS = {
  pb: { // poids du corps
    squat: { name:"Squat au poids du corps", reps:"12-15", sets:3, rest:"60s", equipment:"PB", target:"cuisses/fessiers" },
    hipThrust: { name:"Hip Thrust au sol", reps:"12-15", sets:3, rest:"60s", equipment:"PB", target:"fessiers" },
    pushup: { name:"Pompes", reps:"8-12", sets:3, rest:"75s", equipment:"PB", target:"pecs/épaules/triceps", alt:"Pompes sur les genoux" },
    rowInverted: { name:"Rowing inversé table/TRX", reps:"8-12", sets:3, rest:"75s", equipment:"PB", target:"dos", alt:"Row élastique" },
    plank: { name:"Gainage planche", durationSec:40, sets:3, rest:"45s", equipment:"PB", target:"core" },
    lunge: { name:"Fentes marchées", reps:"10/10", sets:3, rest:"60s", equipment:"PB", target:"cuisses/fessiers" },
    burpee: { name:"Burpees", reps:"10-12", sets:4, rest:"45s", equipment:"PB", target:"full/hiit" },
  },
  db: { // haltères / KB / élastiques
    goblet: { name:"Goblet Squat (DB/KB)", reps:"8-12", sets:4, rest:"90s", equipment:"DB/KB", target:"cuisses/fessiers" },
    rdl: { name:"Romanian Deadlift (DB)", reps:"8-12", sets:4, rest:"90s", equipment:"DB", target:"ischios/fessiers" },
    bench: { name:"Développé couché haltères", reps:"8-12", sets:4, rest:"90s", equipment:"DB", target:"pecs" },
    ohp: { name:"Développé épaules (DB)", reps:"8-12", sets:3, rest:"90s", equipment:"DB", target:"épaules" },
    row: { name:"Row haltère unilatéral", reps:"10/10", sets:4, rest:"75s", equipment:"DB", target:"dos" },
    curl: { name:"Curl biceps (DB)", reps:"10-12", sets:3, rest:"60s", equipment:"DB", target:"bras" },
    triceps: { name:"Extensions triceps (DB)", reps:"10-12", sets:3, rest:"60s", equipment:"DB", target:"bras" },
    bandFacePull: { name:"Face Pull (élastique)", reps:"12-15", sets:3, rest:"60s", equipment:"Band", target:"haut du dos" },
  },
  gym: {
    backSquat: { name:"Back Squat (barre)", reps:"5×5", sets:5, rest:"120s", equipment:"Barre/Rack", target:"cuisses/fessiers", tempo:"30X1", rir:2 },
    deadlift: { name:"Soulevé de terre", reps:"3×5", sets:3, rest:"180s", equipment:"Barre", target:"chaîne postérieure", rir:2 },
    bench: { name:"Développé couché (barre)", reps:"5×5", sets:5, rest:"120s", equipment:"Barre", target:"pecs", rir:2 },
    pull: { name:"Tractions (assistées si besoin)", reps:"6-8", sets:4, rest:"120s", equipment:"Barre fixe", target:"dos" },
    legPress: { name:"Presse à cuisses", reps:"10-12", sets:4, rest:"90s", equipment:"Machine", target:"cuisses" },
    cableRow: { name:"Row poulie", reps:"10-12", sets:4, rest:"75s", equipment:"Poulie", target:"dos" },
  },
  wod: {
    emom: (min=12)=> ({ name:`EMOM ${min}'`, sets:1, reps:`Tour/minute`, rest:"—", notes:"Alt: 1) 12 KBS, 2) 10 Burpees, 3) 15 Air Squats", equipment:"KB/PB", target:"metcon" }),
    amrap: (min=12)=> ({ name:`AMRAP ${min}'`, sets:1, reps:"Rondes max", rest:"—", notes:"10 DB Thrusters · 10 Sit-ups · 10 Box Step-ups", equipment:"DB/PB", target:"metcon" }),
    intervalsRun: { name:"Course 4×4' Z4 (récup 3')", sets:4, durationSec:240, rest:"180s", equipment:"Running", target:"cardio" }
  },
 mobility: {
  "90_90": { name:"90/90 hanches", durationSec:45, sets:2, rest:"20s", target:"mobilité" },
  catCow: { /* ... */ },
  thoracic: { /* ... */ },
  doorway: { /* ... */ },
}
/* ======== Filtre blessures ======== */
function safe(ex: NormalizedExercise, injuries: string[]): NormalizedExercise | null {
  if (injuries.includes("genoux") && /squat|fente|press/i.test(ex.name)) return null;
  if (injuries.includes("epaules") && /(développé|overhead|ohp|tractions)/i.test(ex.name)) return null;
  if (injuries.includes("dos") && /(soulev|deadlift|row)/i.test(ex.name)) return null;
  return ex;
}

/* ======== Génération d’une séance détaillée (blocs) ======== */
function buildSessionBlocks(profile: Profile, kind: { title: string; type: WorkoutType }, plannedMin: number) {
  const warmup: NormalizedExercise[] = [];
  const main: NormalizedExercise[] = [];
  const fin: NormalizedExercise[] = [];
  const acc: NormalizedExercise[] = [];

  // 1) Échauffement (10-12')
  warmup.push({ name:"Mobilité dynamique bas/haut", durationSec:300, rest:"—", block:"echauffement", notes:"chevilles, hanches, T-spine" });
  if (profile.goal !== "mobility") warmup.push({ name:"Activation core (Deadbug)", durationSec:120, rest:"30s", block:"echauffement" });

  // 2) Principal selon contexte
  const addSafe = (e?: NormalizedExercise | null) => { if (e) main.push({ ...e, block:"principal" }); };
  const addSafeAcc = (e?: NormalizedExercise | null) => { if (e) acc.push({ ...e, block:"accessoires" }); };
  const I = profile.injuries;

  if (profile.location === "box" || profile.likesWOD) {
    // WOD style
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
    // Sans matériel / outdoor
    if (kind.type === "hiit" || /HIIT|Circuit/i.test(kind.title)) {
      addSafe(safe(EXOS.pb.burpee, I)); addSafe(safe(EXOS.pb.rowInverted, I)); addSafe(safe(EXOS.pb.lunge, I)); addSafe(safe(EXOS.pb.pushup, I));
      fin.push({ name:"Sprint 6×20\" (récup 100\")", sets:6, durationSec:20, rest:"100s", block:"fin", target:"cardio" });
    } else {
      addSafe(safe(EXOS.pb.squat, I)); addSafe(safe(EXOS.pb.pushup, I)); addSafe(safe(EXOS.pb.rowInverted, I));
      addSafeAcc(safe(EXOS.pb.hipThrust, I)); addSafeAcc(safe(EXOS.pb.plank, I));
    }
  }
};
 // 3) Fin (5-8')
if (fin.length === 0) {
  if (profile.goal === "mobility") {
    const a = EXOS.mobility?.["90_90"];
    const b = EXOS.mobility?.doorway;
    if (a) fin.push({ ...a, block: "fin" });
    if (b) fin.push({ ...b, block: "fin" });
  } else {
    fin.push({ name: "Stretching léger full body", durationSec: 300, rest: "—", block: "fin" });
  }
}

  // Ajustements durée: on tronque accessoires si trop long
  const approxTime = (arr: NormalizedExercise[]) =>
    arr.reduce((t, e) => t + (e.durationSec ? e.durationSec * (e.sets || 1) : (e.sets || 3) * 60), 0);
  const targetSec = plannedMin * 60;
  let totalSec = approxTime(warmup) + approxTime(main) + approxTime(fin) + approxTime(acc);
  while (totalSec > targetSec && acc.length) { acc.pop(); totalSec = approxTime(warmup) + approxTime(main) + approxTime(fin) + approxTime(acc); }

  return [
    { name:"echauffement" as const, items: warmup },
    { name:"principal" as const, items: main },
    { name:"accessoires" as const, items: acc },
    { name:"fin" as const, items: fin },
  ];
}
/* ============ BLOC 3/4 — IA/Rules Fetch + Page UI (avec blocs & exos détaillés) ============ */

/* ===================== Fetch IA (ou règles) ===================== */
async function fetchAiProgramme(userId?: string): Promise<AiProgramme | null> {
  const uidFromCookie = cookies().get("fc_uid")?.value;
  const uid = userId || uidFromCookie || "me";

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
    } catch {}
  }

  // Fallback : moteur de règles local (analyse complète du questionnaire)
  try {
    const email = (await getSignedInEmail()) || cookies().get("app_email")?.value || "";
    if (email) {
      const ans = await getAnswersForEmail(email, SHEET_ID, SHEET_RANGE);
      if (ans) {
        const sessions = generateProgrammeFromAnswers(ans);
        return { sessions: sessions };
      }
    }
  } catch {}
  return null;
}

/* ======== Programme via réponses ======== */
function generateProgrammeFromAnswers(ans: Answers): AiSession[] {
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

/* ===================== Page ===================== */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; done?: string; deleted?: string; take?: string; offset?: string };
}) {
  const store = parseStore(cookies().get("app_sessions")?.value);

  const past = store.sessions
    .filter(s => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  // ===== Mes infos (Prénom + Âge + Mail) depuis la dernière réponse =====
  const detectedEmail = await getSignedInEmail();
  const emailFromCookie = cookies().get("app_email")?.value || "";
  const emailForLink = detectedEmail || emailFromCookie;

  let clientPrenom = "", clientAge: number | undefined, clientEmailDisplay = emailForLink;
  try {
    if (emailForLink) {
      const ans = await getAnswersForEmail(emailForLink, SHEET_ID, SHEET_RANGE);
      if (ans) {
        const get = (k: string) => ans[norm(k)] || ans[k] || "";
        clientPrenom = get("prénom") || get("prenom") || "";
        const ageStr = get("age");
        const num = Number((ageStr || "").toString().replace(",", "."));
        clientAge = Number.isFinite(num) && num > 0 ? Math.floor(num) : undefined;
        const emailSheet = get("email") || get("adresse mail") || get("e-mail") || get("mail");
        if (!clientEmailDisplay && emailSheet) clientEmailDisplay = emailSheet;
      }
    }
  } catch {}

  // Propositions (IA ou règles)
  const programme = await fetchAiProgramme();
  const aiSessions = programme?.sessions ?? [];

  // Pagination compacte
  const takeDefault = 3;
  const take = Math.max(1, Math.min(12, Number(searchParams?.take ?? takeDefault) || takeDefault));
  const reqOffset = Math.max(0, Number(searchParams?.offset ?? 0) || 0);
  const totalAi = aiSessions.length;
  const clampedAi = clampOffset(totalAi, take, reqOffset);
  const visibleAi = aiSessions.slice(clampedAi.offset, clampedAi.offset + take);
  const hasMoreAi = clampedAi.offset + take < totalAi;

  const rawError = searchParams?.error || "";
  const displayedError = rawError;

  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (clientEmailDisplay) qp.set("email", clientEmailDisplay);
    if (clientPrenom) qp.set("prenom", clientPrenom);
    const base = QUESTIONNAIRE_BASE.replace(/\/?$/, "");
    const qs = qp.toString();
    return qs ? `${base}?${qs}` : base;
  })();

  function urlWith(p: Record<string, string | number | undefined>) {
    const sp = new URLSearchParams();
    if (searchParams?.success) sp.set("success", searchParams.success);
    if (searchParams?.error) sp.set("error", searchParams.error);
    if (searchParams?.done) sp.set("done", searchParams.done);
    if (searchParams?.deleted) sp.set("deleted", searchParams.deleted);
    sp.set("take", String(p.take ?? take));
    sp.set("offset", String(p.offset ?? reqOffset));
    return `/dashboard/profile?${sp.toString()}`;
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}>
      <div className="page-header">
        <div><h1 className="h1" style={{ fontSize: 22 }}>Mon profil</h1></div>
        <a href="/dashboard" className="btn" style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500, padding: "6px 10px", lineHeight: 1.2 }}>← Retour</a>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
            {searchParams.success === "programme" ? "✓ Programme IA mis à jour."
            : searchParams.success === "programme:dejainclus" ? "ℹ️ Déjà enregistrée."
            : searchParams.success === "programme:seance:enregistree" ? "✓ Séance enregistrée."
            : "✓ Séance ajoutée."}
          </div>
        )}
        {!!searchParams?.done && (<div className="card" style={{ border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.08)", fontWeight: 600 }}>✓ Séance terminée.</div>)}
        {!!searchParams?.deleted && (<div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}>Séance supprimée.</div>)}
        {!!searchParams?.error && (<div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600, whiteSpace: "pre-wrap" }}>⚠️ {displayedError}</div>)}
      </div>

      {/* ===== Mes infos (Prénom + Âge + Mail) ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Mes infos</h2>
        </div>
        <div className="card">
          <div className="text-sm" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span><b>Prénom :</b> {clientPrenom || <i className="text-gray-400">Non renseigné</i>}</span>
            <span><b>Âge :</b> {typeof clientAge === "number" ? `${clientAge} ans` : <i className="text-gray-400">Non renseigné</i>}</span>
          </div>
          <div className="text-sm" style={{ marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={clientEmailDisplay || "Non renseigné"}>
            <b>Mail :</b>{" "}
            {clientEmailDisplay ? <a href={`mailto:${clientEmailDisplay}`} className="underline">{clientEmailDisplay}</a> : <span className="text-gray-400">Non renseigné</span>}
          </div>
        </div>
      </section>

      {/* Séances proposées — avec affichage des blocs/exos */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>Séances proposées</h2>
            <p className="text-sm" style={{ color: "#6b7280" }}>Personnalisées via l’analyse complète de vos réponses (objectif, matériel, niveau, blessures, etc.).</p>
          </div>
          <a href={questionnaireUrl} className="btn btn-dash">Je mets à jour</a>
        </div>

        {visibleAi.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>Pas encore de séances. <a className="link" href={questionnaireUrl}>Remplissez le questionnaire</a>.</span>
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-3 list-none pl-0">
              {visibleAi.map((s) => {
                const qp = new URLSearchParams({ title: s.title, date: s.date, type: s.type, plannedMin: s.plannedMin ? String(s.plannedMin) : "" });
                const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;

                return (
                  <li key={s.id} className="card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a href={href} className="font-medium underline-offset-2 hover:underline" style={{ fontSize: 16 }}>
                          {s.title}
                        </a>
                        <div className="text-sm" style={{ color: "#6b7280" }}>
                          <b style={{ color: "inherit" }}>{fmtDateYMD(s.date)}</b>
                          {s.plannedMin ? ` · ${s.plannedMin} min` : ""}
                          {s.intensity ? ` · intensité ${s.intensity}` : ""}
                          {s.note ? ` · ${s.note}` : ""}
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>{s.type}</span>
                    </div>

                    {/* Détails blocs */}
                    {s.blocks?.length ? (
                      <div className="mt-3 grid gap-2">
                        {s.blocks.map((b) => (
                          <div key={b.name} className="rounded border p-2">
                            <div className="text-xs uppercase tracking-wide mb-2" style={{ color:"#6b7280" }}>
                              {b.name === "echauffement" ? "Échauffement" :
                               b.name === "principal" ? "Bloc principal" :
                               b.name === "accessoires" ? "Accessoires" : "Fin de séance"}
                            </div>
                            <ul className="text-sm grid gap-1 list-disc pl-5">
                              {b.items.map((e, idx) => (
                                <li key={idx}>
                                  <b>{e.name}</b>
                                  {e.reps ? ` — ${e.reps}` : ""}
                                  {typeof e.sets === "number" ? ` · ${e.sets} séries` : ""}
                                  {e.durationSec ? ` · ${Math.round(e.durationSec/60)}'` : ""}
                                  {e.rest ? ` · repos ${e.rest}` : ""}
                                  {e.rir ? ` · RIR ${e.rir}` : ""}
                                  {e.tempo ? ` · tempo ${e.tempo}` : ""}
                                  {e.notes ? ` · ${e.notes}` : ""}
                                  {e.alt ? <span className="text-gray-500"> (Alt: {e.alt})</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-between mt-3">
              <a href={urlWith({ take, offset: Math.max(0, clampedAi.offset - take) })} className={`btn ${clampedAi.offset <= 0 ? "pointer-events-none opacity-50" : ""}`} aria-disabled={clampedAi.offset <= 0}>← Voir précédent</a>
              <a href={urlWith({ take, offset: clampedAi.offset + take })} className={`btn ${!hasMoreAi ? "pointer-events-none opacity-50" : ""}`} aria-disabled={!hasMoreAi}>Voir plus →</a>
            </div>
          </>
        )}
      </section>

      {/* Séances enregistrées — compacte */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Séances enregistrées</h2>
          {past.length > 12 && <span className="text-xs" style={{ color: "#6b7280" }}>Affichage des 12 dernières</span>}
        </div>

        {past.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🗓️</span>
              <span>Aucune séance enregistrée.</span>
            </div>
          </div>
        ) : (
          <ul className="card divide-y list-none pl-0">
            {past.slice(0, 12).map((s) => {
              const qp = new URLSearchParams({ title: s.title, date: s.date, type: s.type, plannedMin: s.plannedMin ? String(s.plannedMin) : "" });
              const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;
              return (
                <li key={s.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <a href={href} className="font-medium underline-offset-2 hover:underline" style={{ fontSize: 16 }}>
                        {s.title}
                      </a>
                      <div className="text-sm" style={{ color: "#6b7280" }}>
                        {fmtDateISO(s.endedAt)}{s.plannedMin ? ` (prévu ${s.plannedMin} min)` : ""}
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>{s.type}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
/* ============ BLOC 4/4 — Actions, Helpers Feuilles, Lecture réponses ============ */

/* ===================== Actions basiques ===================== */
function uid() { return "id-" + Math.random().toString(36).slice(2, 10); }
function toYMD(d = new Date()) { const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), da=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${da}`; }
export async function addSessionAction(formData: FormData) {
  "use server";
  const title = (formData.get("title") || "").toString().trim();
  const type = (formData.get("type") || "muscu").toString() as WorkoutType;
  const date = (formData.get("date") || toYMD()).toString();
  const plannedMinStr = (formData.get("plannedMin") || "").toString().replace(",", ".");
  const note = (formData.get("note") || "").toString().slice(0, 240);
  const startNow = (formData.get("startNow") || "").toString() === "1";

  if (!title) redirect("/dashboard/profile?error=titre");
  const store = parseStore(cookies().get("app_sessions")?.value);

  const w: Workout = {
    id: uid(), title, type, status: "active", date,
    plannedMin: plannedMinStr ? Number(plannedMinStr) : undefined,
    startedAt: startNow ? new Date().toISOString() : undefined,
    note: note || undefined, createdAt: new Date().toISOString(),
  };

  const next: Store = { sessions: [w, ...store.sessions].slice(0, 300) };
  cookies().set("app_sessions", JSON.stringify(next), { path: "/", sameSite: "lax", maxAge: 60*60*24*365, httpOnly: false });
  redirect("/dashboard/profile?success=1");
}

/* ======== Lecture des réponses (DERNIÈRE ligne) ======== */
const NO_HEADER_COLS = { nom: 0, prenom: 1, age: 2, email: 10 };
async function getAnswersForEmail(email: string, sheetId: string, range: string): Promise<Answers | null> {
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
    headers[NO_HEADER_COLS.nom]   = "nom";
    headers[NO_HEADER_COLS.prenom]= "prenom";
    headers[NO_HEADER_COLS.age]   = "age";
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
      rec["nom"]    = rec["nom"]    || rec[`col${NO_HEADER_COLS.nom}`]    || "";
      rec["prenom"] = rec["prenom"] || rec[`col${NO_HEADER_COLS.prenom}`] || "";
      rec["age"]    = rec["age"]    || rec[`col${NO_HEADER_COLS.age}`]    || "";
      rec["email"]  = rec["email"]  || rec[`col${NO_HEADER_COLS.email}`]  || "";
      return rec;
    }
  }
  return null;
}
