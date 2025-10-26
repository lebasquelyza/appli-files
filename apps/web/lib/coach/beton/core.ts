// apps/web/lib/coach/beton/core.ts
import type {
  AiSession as AiSessionT,
  WorkoutType,
  NormalizedExercise,
} from "../ai";

/* ========================= Types & Options ========================= */
export type PlanOptions = { today?: Date; maxSessions?: number };
export type ProfileInput = {
  prenom?: string; age?: number; objectif?: string; goal?: string;
  equipLevel?: "none" | "limited" | "full"; timePerSession?: number;
  level?: "debutant" | "intermediaire" | "avance";
  injuries?: string[]; equipItems?: string[];
  availabilityText?: string; email?: string; likes?: string[]; dislikes?: string[];
};

/* ====== Focus par séance (split) ====== */
type StrengthFocus =
  | "full" | "bas_quads" | "bas_iscios_glutes"
  | "haut_push" | "haut_pull" | "haut_mix" | "bras_core";

const FOCUS_LABEL: Record<StrengthFocus, string> = {
  full: "Full body",
  bas_quads: "Bas (quadris)",
  bas_iscios_glutes: "Bas (ischios/fessiers)",
  haut_push: "Haut (poussée)",
  haut_pull: "Haut (tirage)",
  haut_mix: "Haut (mix)",
  bras_core: "Bras & Core",
};

function makeFocusPlan(n: number, goalKey: string): StrengthFocus[] {
  const g = (goalKey || "general").toLowerCase();
  if (g === "hypertrophy") {
    if (n <= 1) return ["full"];
    if (n === 2) return ["bas_iscios_glutes", "haut_mix"];
    if (n === 3) return ["bas_quads", "haut_push", "haut_pull"];
    if (n === 4) return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull"];
    if (n === 5) return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull", "bras_core"];
    return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull", "bras_core", "full"];
  }
  if (g === "strength") {
    if (n <= 1) return ["full"];
    if (n === 2) return ["bas_quads", "haut_push"];
    if (n === 3) return ["bas_quads", "haut_pull", "haut_push"];
    if (n === 4) return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull"];
    if (n === 5) return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull", "full"];
    return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull", "full", "full"];
  }
  if (g === "fatloss") {
    if (n <= 1) return ["full"];
    if (n === 2) return ["bas_iscios_glutes", "haut_mix"];
    if (n === 3) return ["full", "haut_mix", "bas_quads"];
    if (n === 4) return ["bas_quads", "haut_mix", "bas_iscios_glutes", "haut_pull"];
    if (n === 5) return ["bas_quads", "haut_mix", "bas_iscios_glutes", "haut_pull", "full"];
    return ["bas_quads", "haut_mix", "bas_iscios_glutes", "haut_pull", "full", "full"];
  }
  if (n <= 1) return ["full"];
  if (n === 2) return ["bas_iscios_glutes", "haut_mix"];
  if (n === 3) return ["bas_quads", "haut_push", "haut_pull"];
  if (n === 4) return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull"];
  if (n === 5) return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull", "full"];
  return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull", "full", "haut_mix"];
}

/* ========================= API principale ========================= */
export function planProgrammeFromProfile(
  profile: ProfileInput = {},
  opts?: PlanOptions
): { sessions: AiSessionT[] } {
  const { today = new Date(), maxSessions: maxOpt } = opts ?? {};

  const inferred = inferMaxSessions(profile.availabilityText);
  const maxSessions = clamp(maxOpt ?? inferred ?? 3, 1, 6);

  const minutes = clamp(profile.timePerSession ?? defaultTime(profile.goal), 20, 90);
  const type = pickType(profile.goal, profile.age);
  const level = profile.level ?? inferLevel(profile.age);
  const equip = profile.equipLevel ?? "limited";
  const goalKey = (profile.goal ?? "general").toLowerCase();

  const ctx: Ctx = {
    level,
    equip,
    minutes,
    goalKey,
    injuries: normalizeInjuries(profile.injuries),
    equipItems: normalizeItems(profile.equipItems),
  };

  const daysList = extractDaysList(profile.availabilityText);
  const focusPlan = type === "muscu" ? makeFocusPlan(maxSessions, goalKey) : [];

  const sessions: AiSessionT[] = [];
  for (let i = 0; i < maxSessions; i++) {
    const d = addDays(today, i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    const variant = i % 3;
    const labelABC = ["A", "B", "C"][variant];

    const dayLabel = daysList[i] ? capitalize(daysList[i]) : labelABC;
    const singleNoDay = maxSessions === 1 && daysList.length === 0;
    const focus: StrengthFocus | undefined = type === "muscu" ? focusPlan[i % focusPlan.length] : undefined;
    const focusSuffix = focus ? ` · ${FOCUS_LABEL[focus]}` : "";

    const title = profile.prenom
      ? singleNoDay
        ? `Séance pour ${profile.prenom}${focusSuffix}`
        : `Séance pour ${profile.prenom} — ${dayLabel}${focusSuffix}`
      : singleNoDay
      ? `${defaultBaseTitle(type)}${focusSuffix}`
      : `${defaultBaseTitle(type)} — ${dayLabel}${focusSuffix}`;

    const exos =
      type === "cardio"
        ? buildCardio(ctx, variant)
        : type === "mobilité"
        ? buildMobility(ctx)
        : type === "hiit"
        ? buildHiit(ctx)
        : buildStrengthFocused(ctx, focus ?? "full", goalKey, profile);

    sessions.push({
      id: `beton-${dateStr}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      type: type as WorkoutType,
      date: dateStr,
      plannedMin: minutes,
      intensity: type === "hiit" ? "élevée" : "modérée",
      exercises: exos,
    } as AiSessionT);
  }

  return { sessions };
}

/* ========================= Inférence nb séances & jours ========================= */
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function inferMaxSessions(text?: string | null): number | undefined {
  if (!text) return undefined;
  const s = String(text).toLowerCase();
  const numMatch = s.match(/\b(\d{1,2})\s*(x|fois|jours?)\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (!Number.isNaN(n)) return clamp(n, 1, 6);
  }
  if (/toute?\s+la\s+semaine|tous?\s+les\s+jours/.test(s)) return 6;

  const days = extractDaysList(s);
  if (days.length) return clamp(days.length, 1, 6);
  return undefined;
}

function extractDaysList(text?: string | null): string[] {
  if (!text) return [];
  const s = String(text).toLowerCase();
  const out: string[] = [];
  const push = (d: string) => { if (!out.includes(d)) out.push(d); };
  if (/week\s*-?\s*end|weekend/.test(s)) { push("samedi"); push("dimanche"); }
  for (const d of DAYS) if (new RegExp(`\\b${d}\\b`, "i").test(s)) push(d);
  return out;
}

function capitalize(str: string) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }
function defaultBaseTitle(t: WorkoutType) { return t === "cardio" ? "Cardio" : t === "mobilité" ? "Mobilité" : t === "hiit" ? "HIIT" : "Muscu"; }

/* ========================= Contexte & utils ========================= */
type Ctx = {
  level: "debutant" | "intermediaire" | "avance";
  equip: "none" | "limited" | "full";
  minutes: number; goalKey: string; injuries: Injuries; equipItems: Items;
};
type Injuries = { back?: boolean; shoulder?: boolean; knee?: boolean; wrist?: boolean; hip?: boolean; ankle?: boolean; elbow?: boolean; };
type Items = { bands?: boolean; kb?: boolean; trx?: boolean; bench?: boolean; bar?: boolean; db?: boolean; bike?: boolean; rower?: boolean; treadmill?: boolean; };

function clamp(n:number,a:number,b:number){ return Math.max(a, Math.min(b,n)); }
function addDays(d:Date,n:number){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function defaultTime(goal?: string){ switch((goal ?? "").toLowerCase()){ case "endurance": return 35; case "mobility": return 25; case "fatloss": return 35; default: return 45; } }
function pickType(goal?: string, age?: number): WorkoutType { const g=(goal ?? "").toLowerCase(); if (g==="endurance") return "cardio"; if (g==="mobility") return "mobilité"; if (g==="fatloss" && (age ?? 0) > 45) return "hiit"; return "muscu"; }
function inferLevel(age?: number): "debutant" | "intermediaire" | "avance" { if (!age) return "intermediaire"; if (age < 25) return "intermediaire"; if (age > 50) return "debutant"; return "intermediaire"; }

/* ========================= Normalisations ========================= */
function normalizeInjuries(list?: string[]): Injuries {
  const txt = (list || []).map(s => String(s || "").toLowerCase());
  const has = (pat: RegExp) => txt.some(s => pat.test(s));
  return {
    back: has(/dos|lomb|rachis|back|spine/),
    shoulder: has(/epaul|épaul|shoulder/),
    knee: has(/genou|knee/),
    wrist: has(/poignet|wrist/),
    hip: has(/hanche|hip/),
    ankle: has(/cheville|ankle/),
    elbow: has(/coude|elbow/),
  };
}
function normalizeItems(list?: string[]): Items {
  const txt = (list || []).map(s => String(s || "").toLowerCase());
  const has = (pat: RegExp) => txt.some(s => pat.test(s));
  return {
    bands: has(/elas|élast|band/),
    kb: has(/kb|kettlebell/),
    trx: has(/trx|suspens/),
    bench: has(/banc|bench/),
    bar: has(/barre|barbell/),
    db: has(/halter|haltère|dumbbell|halt/),
    bike: has(/velo|vélo|bike|spinning/),
    rower: has(/rameur|row/),
    treadmill: has(/tapis|tread/),
  };
}

/* ========================= Cardio / Mobility / HIIT ========================= */
function buildCardio(ctx: Ctx, variantIdx: number): NormalizedExercise[] {
  const { minutes, equipItems } = ctx;
  const warm = { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" } as NormalizedExercise;
  const cool = { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" } as NormalizedExercise;
  const main: NormalizedExercise =
    variantIdx % 2 === 0
      ? { name: equipItems.bike ? "Vélo Z2 continu" : equipItems.rower ? "Rameur Z2 continu" : "Z2 continu", reps: `${Math.max(15, minutes - 12)} min`, block: "principal" }
      : { name: equipItems.treadmill ? "Fractionné Z2/Z3 sur tapis" : "Fractionné Z2/Z3", reps: "12×(1’/1’)", block: "principal" };
  return [warm, main, cool];
}

function buildMobility(_ctx: Ctx): NormalizedExercise[] {
  return [
    { name: "Respiration diaphragmatique", reps: "2–3 min", block: "echauffement" },
    { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
    { name: "T-spine rotations", reps: "8–10/ côté", block: "principal" },
    { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
  ];
}

function buildHiit(ctx: Ctx): NormalizedExercise[] {
  return [
    { name: "Air Squats", reps: "40s", rest: "20s", block: "principal" },
    { name: "Mountain Climbers", reps: "40s", rest: "20s", block: "principal" },
    adjustForInjuries(ctx, { name: "Burpees (option sans saut)", reps: "30–40s", rest: "30–40s", block: "principal", notes: "Retire le saut/impact si genoux sensibles." }),
  ];
}

/* ========================= Musculation ========================= */
type PoolItem = {
  name: string;
  need?: ("bar" | "db" | "bench" | "machine" | "kb" | "bands" | "trx")[];
  fallback?: string;
  area?: "bas" | "haut" | "dos";
  kind?: "main" | "assist" | "iso" | "core";
  contra?: (inj: Injuries) => boolean;
};

const POOLS: Record<StrengthFocus, PoolItem[]> = {
  full: [
    { name: "Goblet Squat", need: ["db"], area: "bas", kind: "main" },
    { name: "Tirage vertical", need: ["machine", "bands"], area: "dos", kind: "main", fallback: "Tirage élastique" },
    { name: "Développé haltères", need: ["db"], area: "haut", kind: "assist", fallback: "Pompes surélevées" },
    { name: "Élévations latérales", need: ["db", "bands"], area: "haut", kind: "iso" },
    { name: "Curl biceps (élastique/haltères)", need: ["db", "bands"], area: "haut", kind: "iso" },
  ],
  bas_quads: [
    { name: "Front Squat", need: ["bar"], area: "bas", kind: "main", fallback: "Goblet Squat", contra: (i) => !!i.back },
    { name: "Presse à cuisses", need: ["machine"], area: "bas", kind: "assist", fallback: "Fente arrière" },
    { name: "Fente arrière", area: "bas", kind: "assist" },
    { name: "Leg Extension (élastique/machine)", need: ["machine", "bands"], area: "bas", kind: "iso", fallback: "Squat partiel" },
  ],
  bas_iscios_glutes: [
    { name: "Hip Thrust (barre/haltère)", need: ["bench"], area: "bas", kind: "main", fallback: "Hip Thrust au sol" },
    { name: "Soulevé de terre roumain", need: ["bar"], area: "bas", kind: "main", fallback: "RDL haltères", contra: (i) => !!i.back },
    { name: "Good Morning haltères", need: ["db"], area: "bas", kind: "assist", fallback: "Pont fessier" },
    { name: "Leg Curl (élastique)", need: ["bands"], area: "bas", kind: "iso", fallback: "Nordic curl assisté" },
    { name: "Abduction hanches (élastique)", need: ["bands"], area: "bas", kind: "iso" },
  ],
  haut_push: [
    { name: "Bench Press", need: ["bar", "bench"], area: "haut", kind: "main", fallback: "Développé haltères", contra: (i) => !!i.shoulder },
    { name: "Développé haltères incliné", need: ["db"], area: "haut", kind: "main", fallback: "Pompes surélevées" },
    { name: "Élévations latérales", need: ["db", "bands"], area: "haut", kind: "iso" },
    { name: "Triceps extension (poulie/élastique)", need: ["machine", "bands"], area: "haut", kind: "iso", fallback: "Extension triceps haltères" },
    { name: "Écartés (haltères/élastique)", need: ["db", "bands"], area: "haut", kind: "iso" },
  ],
  haut_pull: [
    { name: "Tractions / Tirage vertical", need: ["machine", "bands"], area: "dos", kind: "main", fallback: "Tirage élastique" },
    { name: "Rowing unilatéral", need: ["db"], area: "dos", kind: "main", fallback: "Row avec serviette/table" },
    { name: "Face Pull (câble/élastique)", need: ["machine", "bands"], area: "dos", kind: "
