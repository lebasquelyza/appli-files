// apps/web/lib/coach/beton/index.ts
import type {
  AiSession as AiSessionT,
  WorkoutType,
  NormalizedExercise,
  Profile as ProfileT,
} from "../ai";
import {
  getAnswersForEmail as _getAnswersForEmail,
  buildProfileFromAnswers as _buildProfileFromAnswers,
} from "../ai";
function makeFocusPlan(maxSessions: number, goalKey: string) {
  const target = goalKey || "full";
  return Array.from({ length: maxSessions }, () => target);
}


/* ========================= Types & Options ========================= */
export type PlanOptions = {
  today?: Date;
  maxSessions?: number; // 1..6 (jours/semaine)
};

type ProfileInput = {
  prenom?: string;
  age?: number;
  objectif?: string; // libellé brut (affichage)
  goal?: string; // clé normalisée: hypertrophy|fatloss|strength|endurance|mobility|general
  equipLevel?: "none" | "limited" | "full";
  timePerSession?: number;
  level?: "debutant" | "intermediaire" | "avance";
  injuries?: string[];
  equipItems?: string[];
  availabilityText?: string;
  email?: string;
  likes?: string[];
  dislikes?: string[];
  // NEW: cibles explicites détectées dans l'objectif (optionnel)
  targets?: string[];
};

/* ====== Focus par séance (split) ====== */
type StrengthFocus =
  | "full"
  | "bas_quads"
  | "bas_iscios_glutes"
  | "haut_push"
  | "haut_pull"
  | "haut_mix"
  | "bras_core";

const FOCUS_LABEL: Record<StrengthFocus, string> = {
  full: "Full body",
  bas_quads: "Bas (quadris)",
  bas_iscios_glutes: "Bas (ischios/fessiers)",
  haut_push: "Haut (poussée)",
  haut_pull: "Haut (tirage)",
  haut_mix: "Haut (mix)",
  bras_core: "Bras & Core",
};

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

  // NEW: cibles détectées dans l’objectif (optionnel)
  const detectedTargets =
    (profile.targets && profile.targets.length)
      ? normalizeTargets(profile.targets)
      : parseTargetsFromText(profile.objectif || profile.goal || "");

  const daysList = extractDaysList(profile.availabilityText);
const focusPlanData = type === "muscu" ? makeFocusPlan(maxSessions, goalKey) : [];


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

    const targetKey = detectedTargets[i % Math.max(1, detectedTargets.length)];

    let title = "";
    let exos: NormalizedExercise[] = [];

    if (type !== "muscu") {
      title = profile.prenom
        ? singleNoDay ? `${defaultBaseTitle(type)}` : `${defaultBaseTitle(type)} — ${dayLabel}`
        : singleNoDay ? `${defaultBaseTitle(type)}` : `${defaultBaseTitle(type)} — ${dayLabel}`;
      exos =
        type === "cardio" ? buildCardio(ctx, variant)
        : type === "mobilité" ? buildMobility(ctx)
        : buildHiit(ctx);
    } else if (targetKey) {
      const targetLabel = TARGET_LABEL[targetKey] || capitalize(targetKey);
      title = profile.prenom
        ? singleNoDay
          ? `Séance pour ${profile.prenom} — ${targetLabel}`
          : `Séance pour ${profile.prenom} — ${dayLabel} · ${targetLabel}`
        : singleNoDay
          ? `Séance — ${targetLabel}`
          : `Séance — ${dayLabel} · ${targetLabel}`;
      exos = buildStrengthTargeted(ctx, targetKey, goalKey, profile);
    } else {
      const focus: StrengthFocus | undefined = focusPlan[i % focusPlan.length];
      const focusSuffix = focus ? ` · ${FOCUS_LABEL[focus]}` : "";
      title = profile.prenom
        ? singleNoDay
          ? `Séance pour ${profile.prenom}${focusSuffix}`
          : `Séance pour ${profile.prenom} — ${dayLabel}${focusSuffix}`
        : singleNoDay
          ? `${defaultBaseTitle(type)}${focusSuffix}`
          : `${defaultBaseTitle(type)} — ${dayLabel}${focusSuffix}`;
      exos = buildStrengthFocused(ctx, focus ?? "full", goalKey, profile);
    }

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

/* ========================= Inférence du nb de séances & Jours ========================= */
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function inferMaxSessions(text?: string | null): number | undefined {
  if (!text) return undefined;
  const s = String(text).toLowerCase();

  // ✅ Détection uniquement des chiffres 1 à 7
  const numMatch = s.match(/\b([1-7])\s*(x|fois|jours?)?\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (!Number.isNaN(n)) return clamp(n, 1, 7);
  }

  // ✅ Cas “toute la semaine” ou “tous les jours”
  if (/toute?\s+la\s+semaine|tous?\s+les\s+jours/.test(s)) return 7;

  // ✅ Détection des jours de la semaine
  const days = extractDaysList(s);
  if (days.length) return clamp(days.length, 1, 7);

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

function availabilityTextFromAnswers(answers: any): string | undefined {
  if (!answers) return undefined;

  // ✅ Détection chiffres 1 à 7 + jours/semaine
  const dayPat =
    /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week\s*-?\s*end|weekend|jours?\s+par\s+semaine|\b[1-7]\s*(x|fois|jours?)?)/i;

  const candidates: string[] = [];
  for (const k of ["daysPerWeek", "jours", "séances/semaine", "seances/semaine", "col_I"]) {
    const v = answers[k];
    if (typeof v === "string" || typeof v === "number") candidates.push(String(v));
  }
  for (const k of Object.keys(answers)) {
    const v = answers[k];
    if (typeof v === "string" || typeof v === "number") candidates.push(String(v));
  }

  const hits = candidates
    .map((v) => String(v ?? "").trim())
    .filter((v) => v && dayPat.test(v));

  return hits.length ? hits.join(" ; ") : undefined;
}

/* ========================= Contexte & utils ========================= */
type Ctx = {
  level: "debutant" | "intermediaire" | "avance";
  equip: "none" | "limited" | "full";
  minutes: number;
  goalKey: string;
  injuries: Injuries;
  equipItems: Items;
};
type Injuries = { back?: boolean; shoulder?: boolean; knee?: boolean; wrist?: boolean; hip?: boolean; ankle?: boolean; elbow?: boolean; };
type Items = { bands?: boolean; kb?: boolean; trx?: boolean; bench?: boolean; bar?: boolean; db?: boolean; bike?: boolean; rower?: boolean; treadmill?: boolean; };

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function defaultTime(goal?: string) {
  switch ((goal ?? "").toLowerCase()) {
    case "endurance": return 35;
    case "mobility": return 25;
    case "fatloss": return 35;
    default: return 45;
  }
}
function pickType(goal?: string, age?: number): WorkoutType {
  const g = (goal ?? "").toLowerCase();
  if (g === "endurance") return "cardio";
  if (g === "mobility") return "mobilité";
  if (g === "fatloss" && (age ?? 0) > 45) return "hiit";
  return "muscu";
}
function inferLevel(age?: number): "debutant" | "intermediaire" | "avance" {
  if (!age) return "intermediaire";
  if (age < 25) return "intermediaire";
  if (age > 50) return "debutant";
  return "intermediaire";
}

/* ========================= Normalisations ========================= */
function normalizeInjuries(list?: string[]): Injuries {
  const txt = (list || []).map((s) => String(s || "").toLowerCase());
  const has = (pat: RegExp) => txt.some((s) => pat.test(s));
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
  const txt = (list || []).map((s) => String(s || "").toLowerCase());
  const has = (pat: RegExp) => txt.some((s) => pat.test(s));
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

/* ========================= Cardio/Mobility/HIIT ========================= */
function buildCardio(ctx: Ctx, variantIdx: number): NormalizedExercise[] {
  const { minutes, equipItems } = ctx;
  const warm = { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" } as NormalizedExercise;
  const cool = { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" } as NormalizedExercise;

  let main: NormalizedExercise;
  if (variantIdx % 2 === 0) {
    const dur = Math.max(15, minutes - 12);
    main = {
      name: equipItems.bike ? "Vélo Z2 continu" : equipItems.rower ? "Rameur Z2 continu" : "Z2 continu",
      reps: `${dur} min`,
      block: "principal",
    };
  } else {
    main = {
      name: equipItems.treadmill ? "Fractionné Z2/Z3 sur tapis" : "Fractionné Z2/Z3",
      reps: "12×(1’/1’)",
      block: "principal",
    };
  }
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
  const out: NormalizedExercise[] = [];
  out.push({ name: "Air Squats", reps: "40s", rest: "20s", block: "principal" });
  out.push({ name: "Mountain Climbers", reps: "40s", rest: "20s", block: "principal" });
  out.push(adjustForInjuries(ctx, { name: "Burpees (option sans saut)", reps: "30–40s", rest: "30–40s", block: "principal", notes: "Retire le saut/impact si genoux sensibles." }));
  return out;
}

/* ========================= Sélection dynamique Muscu (SPLIT existant) ========================= */
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
    { name: "Face Pull (câble/élastique)", need: ["machine", "bands"], area: "dos", kind: "assist", fallback: "Tirage horizontal élastique" },
    { name: "Curl biceps (haltères/élastique)", need: ["db", "bands"], area: "haut", kind: "iso" },
  ],
  haut_mix: [
    { name: "Développé haltères", need: ["db"], area: "haut", kind: "main", fallback: "Pompes surélevées" },
    { name: "Rowing buste penché", need: ["db"], area: "dos", kind: "main", fallback: "Tirage élastique" },
    { name: "Pompes surélevées", area: "haut", kind: "assist" },
    { name: "Élévations latérales", need: ["db", "bands"], area: "haut", kind: "iso" },
    { name: "Curl incliné (haltères)", need: ["db"], area: "haut", kind: "iso" },
  ],
  bras_core: [
    { name: "Curl biceps (haltères/élastique)", need: ["db", "bands"], area: "haut", kind: "iso" },
    { name: "Extension triceps (poulie/élastique)", need: ["machine", "bands"], area: "haut", kind: "iso", fallback: "Extension triceps haltères" },
    { name: "Hollow Hold", area: "haut", kind: "core" },
    { name: "Side Plank (gauche/droite)", area: "haut", kind: "core" },
  ],
};

/* ===== Estimation du temps & normalisation ===== */
function baseRest(goal: string) {
  const g = (goal || "general").toLowerCase();
  if (g === "strength") return 120;
  if (g === "hypertrophy") return 75;
  if (g === "fatloss") return 45;
  return 60;
}
function defaultSets(level: Ctx["level"], isBW = false) {
  if (isBW) return level === "avance" ? 4 : 3;
  return level === "avance" ? 4 : level === "intermediaire" ? 3 : 2;
}
function defaultReps(goal: string, main = false) {
  const g = (goal || "general").toLowerCase();
  if (g === "strength") return main ? "3–5" : "4–6";
  if (g === "hypertrophy") return main ? "6–10" : "10–15";
  if (g === "fatloss") return main ? "10–12" : "12–20";
  return main ? "6–10" : "8–12";
}
function estimateSetSeconds(goal: string) {
  const g = (goal || "general").toLowerCase();
  if (g === "strength") return 25;
  if (g === "hypertrophy") return 30;
  if (g === "fatloss") return 25;
  return 28;
}
function estimateExerciseMinutes(ex: NormalizedExercise, goal: string) {
  const sets = ex.sets ?? 3;
  const setSec = estimateSetSeconds(goal);
  const restSec = parseRestToSec(ex.rest) || baseRest(goal);
  return (sets * (setSec + restSec)) / 60;
}
function parseRestToSec(r?: string) {
  if (!r) return 0;
  const m = r.match(/(\d+)\s*-\s*(\d+)s/);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const s = r.match(/(\d+)\s*s/);
  if (s) return Number(s[1]);
  return 0;
}

/** Equipements */
function hasEquipment(
  ctx: Ctx,
  need: "bar" | "db" | "bench" | "machine" | "kb" | "bands" | "trx"
) {
  if (ctx.equip === "full") return true;
  switch (need) {
    case "db": return !!ctx.equipItems.db;
    case "bar": return !!ctx.equipItems.bar;
    case "bench": return !!ctx.equipItems.bench;
    case "machine": return false;
    case "kb": return !!ctx.equipItems.kb;
    case "bands": return !!ctx.equipItems.bands;
    case "trx": return !!ctx.equipItems.trx;
    default: return false;
  }
}
function matchesPreference(name: string, list?: string[]) {
  if (!list || list.length === 0) return false;
  const n = name.toLowerCase();
  return list.some((k) => n.includes(k.toLowerCase()));
}
function estimateTotalMinutes(list: NormalizedExercise[], goal: string) {
  return list.reduce((sum, e) => sum + estimateExerciseMinutes(e, goal), 0);
}

/* ========================= MUSCU ciblée par muscle (NOUVEAU) ========================= */
type TargetKey = "shoulders"|"quads"|"hams_glutes"|"back"|"chest"|"biceps"|"triceps"|"core"|"calves"|"full";
export const TARGET_LABEL: Record<TargetKey,string> = {
  shoulders: "Épaules",
  quads: "Quadriceps",
  hams_glutes: "Fessiers/Ischios",
  back: "Dos",
  chest: "Pectoraux",
  biceps: "Biceps",
  triceps: "Triceps",
  core: "Abdos/Core",
  calves: "Mollets",
  full: "Full body",
};

// banque d’exos par cible (style simple, proche de ton exemple)
type TP = { name: string; need?: ("bar"|"db"|"bands"|"machine"|"bench"|"trx")[]; kind?: "main"|"assist"|"iso"; fallback?: string; };
const TARGET_POOLS: Record<TargetKey, TP[]> = {
  shoulders: [
    { name: "Développé militaire", need:["bar","bench"], kind:"main", fallback:"Développé haltères" },
    { name: "Développé haltères", need:["db"], kind:"main", fallback:"Pompes surélevées" },
    { name: "Élévations latérales", need:["db","bands"], kind:"iso" },
    { name: "Oiseau haltères", need:["db"], kind:"iso", fallback:"Tirage élastique arrière" },
    { name: "Face Pull (élastique)", need:["bands"], kind:"assist" },
  ],
  quads: [
    { name: "Back Squat", need:["bar","bench"], kind:"main", fallback:"Goblet Squat" },
    { name: "Front Squat", need:["bar"], kind:"main", fallback:"Goblet Squat" },
    { name: "Leg Extension", need:["machine","bands"], kind:"iso", fallback:"Squat partiel" },
    { name: "Fente avant", kind:"assist" },
    { name: "Presse à cuisses", need:["machine"], kind:"assist", fallback:"Fente arrière" },
  ],
  hams_glutes: [
    { name: "Hip Thrust (barre/haltère)", need:["bench"], kind:"main", fallback:"Hip Thrust au sol" },
    { name: "Soulevé de terre roumain", need:["bar"], kind:"main", fallback:"RDL haltères" },
    { name: "Good Morning haltères", need:["db"], kind:"assist", fallback:"Pont fessier" },
    { name: "Leg Curl (élastique)", need:["bands"], kind:"iso", fallback:"Nordic curl assisté" },
  ],
  back: [
    { name: "Tractions / Tirage vertical", need:["machine","bands"], kind:"main", fallback:"Tirage élastique" },
    { name: "Rowing unilatéral", need:["db"], kind:"main", fallback:"Row avec serviette/table" },
    { name: "Face Pull (élastique)", need:["bands"], kind:"assist", fallback:"Tirage horizontal élastique" },
  ],
  chest: [
    { name: "Bench Press", need:["bar","bench"], kind:"main", fallback:"Développé haltères" },
    { name: "Développé haltères incliné", need:["db"], kind:"main", fallback:"Pompes surélevées" },
    { name: "Écartés haltères", need:["db"], kind:"iso", fallback:"Écartés élastique" },
    { name: "Pompes surélevées", kind:"assist" },
  ],
  biceps: [
    { name: "Curl barre", need:["bar"], kind:"main", fallback:"Curl haltères" },
    { name: "Curl incliné (haltères)", need:["db"], kind:"iso" },
    { name: "Curl marteau", need:["db"], kind:"iso" },
  ],
  triceps: [
    { name: "Dips banc", need:["bench"], kind:"main", fallback:"Pompes serrées" },
    { name: "Extension triceps (poulie/élastique)", need:["machine","bands"], kind:"iso", fallback:"Extension triceps haltères" },
    { name: "Barre front", need:["bar"], kind:"assist", fallback:"Kickback haltère" },
  ],
  core: [
    { name: "Gainage planche", kind:"iso" },
    { name: "Hollow Hold", kind:"iso" },
    { name: "Side Plank (gauche/droite)", kind:"iso" },
    { name: "Dead Bug", kind:"assist" },
  ],
  calves: [
    { name: "Mollets debout", kind:"iso" },
    { name: "Mollets assis", kind:"iso", fallback:"Mollets debout" },
    { name: "Sauts corde (option)", kind:"assist", fallback:"Montées sur pointes" },
  ],
  full: [
    { name: "Goblet Squat", need:["db"], kind:"main" },
    { name: "Développé haltères", need:["db"], kind:"assist", fallback:"Pompes surélevées" },
    { name: "Rowing unilatéral", need:["db"], kind:"main", fallback:"Tirage serviette" },
    { name: "Élévations latérales", need:["db","bands"], kind:"iso" },
  ],
};

function normalizeTargets(list: string[]): TargetKey[] {
  const set = new Set<TargetKey>();
  for (const raw of list) {
    const t = String(raw || "").toLowerCase();
    if (/epaules|épaules|shoulder/.test(t)) set.add("shoulders");
    else if (/quadri|quadriceps|quads?/.test(t)) set.add("quads");
    else if (/ischio|fessier|glute|ham/.test(t)) set.add("hams_glutes");
    else if (/dos|back|tirage/.test(t)) set.add("back");
    else if (/pec|pectoral|chest/.test(t)) set.add("chest");
    else if (/biceps/.test(t)) set.add("biceps");
    else if (/triceps/.test(t)) set.add("triceps");
    else if (/abdo|core|gainage/.test(t)) set.add("core");
    else if (/mollet|calves?/.test(t)) set.add("calves");
    else if (/full|tout le corps/i.test(t)) set.add("full");
  }
  return Array.from(set);
}
function parseTargetsFromText(txt: string): TargetKey[] {
  const s = String(txt || "").toLowerCase();
  const hits: string[] = [];
  const add = (k: string) => hits.push(k);
  if (/epaul|épaul|shoulder/.test(s)) add("shoulders");
  if (/quadri|quadriceps|quads?/.test(s)) add("quads");
  if (/ischio|fessier|glute|ham/.test(s)) add("hams_glutes");
  if (/dos|back|tirage/.test(s)) add("back");
  if (/pec|pector|chest/.test(s)) add("chest");
  if (/biceps/.test(s)) add("biceps");
  if (/triceps/.test(s)) add("triceps");
  if (/abdo|core|gainage/.test(s)) add("core");
  if (/mollet|calves?/.test(s)) add("calves");
  if (/full|tout le corps/.test(s)) add("full");
  return normalizeTargets(hits);
}

/** Génération d'une séance 100% ciblée */
function buildStrengthTargeted(
  ctx: Ctx,
  target: TargetKey,
  goalKey: string,
  profile?: ProfileInput
): NormalizedExercise[] {
  const likes = profile?.likes || [];
  const dislikes = profile?.dislikes || [];
  const pool = (TARGET_POOLS[target] || []).slice();

  const filtered = pool.filter(p => {
    if (p.need && !p.need.every(n => hasEquipment(ctx, n as any))) {
      if (!p.fallback) return false;
    }
    if (matchesPreference(p.name, dislikes)) return false;
    return true;
  });

  // tri: préférés en premier, puis main > assist > iso
  const kindRank: Record<NonNullable<TP["kind"]>, number> = { main: 0, assist: 1, iso: 2 };
  filtered.sort((a, b) => {
    const likeA = matchesPreference(a.name, likes) ? -1 : 0;
    const likeB = matchesPreference(b.name, likes) ? -1 : 0;
    if (likeA !== likeB) return likeA - likeB;
    return (kindRank[a.kind || "assist"] ?? 9) - (kindRank[b.kind || "assist"] ?? 9);
  });

  const out: NormalizedExercise[] = [];
  out.push({ name: "Activation spécifique", reps: "3–5 min", block: "echauffement" });

  const targetMin = clamp(ctx.minutes, 20, 90);
  let usedMin = 0;

  for (const p of filtered) {
    const usable = p.need && !p.need.every(n => hasEquipment(ctx, n as any)) ? (p.fallback || p.name) : p.name;

    const isBW = /pompes|gainage|plank|hollow|serviette|élastique/i.test(usable);
    const isMain = p.kind === "main";

    const ex: NormalizedExercise = {
      name: usable,
      sets: defaultSets(ctx.level, isBW),
      reps: defaultReps(goalKey, isMain),
      rest: goalKey === "strength" ? "120–150s" : goalKey === "fatloss" ? "45–60s" : isMain ? "75–90s" : "60–75s",
      tempo: tempoFor(ctx.goalKey),
      rir: rirFor(ctx.level),
      block: "principal",
    };

    const mins = estimateExerciseMinutes(ex, goalKey);
    if (usedMin + mins > targetMin + 4) continue;

    out.push(adjustForInjuries(ctx, ex));
    usedMin += mins;

    if (usedMin >= targetMin - 2) break;
  }

  if (estimateTotalMinutes(out, goalKey) < targetMin - 6) {
    out.push(adjustForInjuries(ctx, { name: "Gainage planche", sets: 2, reps: "30–45s", rest: goalKey === "fatloss" ? "30–45s" : "45–60s", block: "fin" }));
  }
  return out;
}

/* ========================= MUSCU (sélection existante) ========================= */
function buildStrengthFocused(
  ctx: Ctx,
  focus: StrengthFocus,
  goalKey: string,
  profile?: ProfileInput
): NormalizedExercise[] {
  const g = (goalKey || "general").toLowerCase();
  const out: NormalizedExercise[] = [];

  out.push({ name: focus.startsWith("bas") ? "Activation hanches/chevilles" : "Activation épaules/omoplates", reps: "3–5 min", block: "echauffement" });

  const likes = profile?.likes || [];
  const dislikes = profile?.dislikes || [];
  const pool = (POOLS[focus] || []).slice();

  const filtered: PoolItem[] = pool.filter((p) => {
    if (p.contra?.(ctx.injuries)) return false;
    if (p.need && !p.need.every((n) => hasEquipment(ctx, n))) {
      if (!p.fallback) return false;
    }
    if (matchesPreference(p.name, dislikes)) return false;
    return true;
  });

  const kindRank: Record<NonNullable<PoolItem["kind"]>, number> = { main: 0, assist: 1, iso: 2, core: 3 };
  filtered.sort((a, b) => {
    const likeA = matchesPreference(a.name, likes) ? -1 : 0;
    const likeB = matchesPreference(b.name, likes) ? -1 : 0;
    if (likeA !== likeB) return likeA - likeB;
    return (kindRank[a.kind || "assist"] ?? 9) - (kindRank[b.kind || "assist"] ?? 9);
  });

  const targetMin = clamp(ctx.minutes, 20, 90);
  let usedMin = 0;

  for (const p of filtered) {
    const usableName = p.need && !p.need.every((n) => hasEquipment(ctx, n)) ? p.fallback || p.name : p.name;

    const isBW = /pompes|hollow|plank|pont|tirage élastique|traction|row.*serviette/i.test(usableName);
    const isMain = p.kind === "main";

    const base: NormalizedExercise = {
      name: usableName,
      sets: defaultSets(ctx.level, isBW),
      reps: defaultReps(g, isMain),
      rest: g === "strength" ? "120–150s" : g === "fatloss" ? "45–60s" : isMain ? "75–90s" : "60–75s",
      tempo: tempoFor(ctx.goalKey),
      rir: rirFor(ctx.level),
      block: "principal",
    };

    const mins = estimateExerciseMinutes(base, g);
    if (usedMin + mins > targetMin + 4) continue;

    out.push(adjustForInjuries(ctx, base));
    usedMin += mins;

    const mains = out.filter((e) =>
      /Squat|Presse|Soulevé|Développé|Row(?!.*serviette)|Tirage|Tractions|Hip Thrust|Bench/i.test(e.name)
    ).length;

    if (usedMin >= targetMin * 0.7 && mains >= 3) {
      if (targetMin - usedMin >= 5) {
        out.push(adjustForInjuries(ctx, { name: "Gainage planche", sets: 2, reps: "30–45s", rest: g === "fatloss" ? "30–45s" : "45–60s", block: "fin" }));
      }
      break;
    }
    if (usedMin >= targetMin - 2) break;
  }

  if (estimateTotalMinutes(out, g) < targetMin - 6) {
    out.push(adjustForInjuries(ctx, { name: "Side Plank (gauche/droite)", sets: 2, reps: "20–30s/ côté", rest: "45s", block: "fin" }));
  }
  return out;
}

/* ========================= Ajustements blessures & items ========================= */
function adjustForInjuries(ctx: Ctx, ex: NormalizedExercise): NormalizedExercise {
  const e: NormalizedExercise = { ...ex };

  if (e.sets && !e.rir) e.rir = rirFor(ctx.level);
  if (e.sets && !e.tempo) e.tempo = tempoFor(ctx.goalKey);

  if (ctx.injuries.back) {
    if (/back squat|soulevé de terre|deadlift|row à la barre/i.test(e.name)) {
      return swap(e, preferBackFriendly(e, ctx));
    }
    if (/superman/i.test(e.name)) {
      e.notes = joinNotes(e.notes, "Si gêne au dos, réduire l’amplitude ou remplacer par Bird-Dog.");
    }
  }
  if (ctx.injuries.shoulder) {
    if (/militaire|overhead|développé militaire|élevations latérales lourdes/i.test(e.name)) {
      return swap(e, { name: "Développé haltères neutre", sets: e.sets ?? 3, reps: repsFor(ctx.goalKey), rest: "75s", block: e.block, equipment: "haltères", notes: "Prise neutre, amplitude confortable." });
    }
    if (/dips/i.test(e.name)) {
      return swap(e, { name: "Pompes surélevées", sets: e.sets ?? 3, reps: pickBodyweight(ctx.goalKey), rest: "60–75s", block: "principal", equipment: "poids du corps" });
    }
  }
  if (ctx.injuries.knee) {
    if (/sauté|jump|burpee/i.test(e.name)) {
      return swap(e, { name: "Marche rapide / step-ups bas", sets: e.sets ?? 3, reps: "10–12/ côté", rest: "60s", block: "principal", notes: "Hauteur basse, sans douleur." });
    }
    if (/squat(?!.*goblet)|fente/i.test(e.name)) {
      e.notes = joinNotes(e.notes, "Amplitude contrôlée, pas de douleur, option appui/assistance.");
    }
  }
  if (ctx.injuries.wrist && /pompes|push-up/i.test(e.name)) {
    e.notes = joinNotes(e.notes, "Utiliser poignées de pompe ou poings fermés pour garder le poignet neutre.");
  }
  if (ctx.injuries.hip && /squat|fente/i.test(e.name)) {
    e.notes = joinNotes(e.notes, "Amplitude confortable, focus stabilité hanche.");
  }
  if (ctx.injuries.ankle && /sauté|jump/i.test(e.name)) {
    return swap(e, { name: "Marche rapide inclinée", sets: e.sets ?? 3, reps: "2–3 min", rest: "60s", block: "principal" });
  }

  if (/tirage élastique|row|tirage/i.test(e.name)) {
    if ((ctx.equipItems as any).bands) e.equipment = e.equipment || "élastiques";
  }
  if (/kettlebell|kb/i.test(e.name) && !(ctx.equipItems as any).kb) {
    return swap(e, { ...e, name: e.name.replace(/kettlebell|KB/i, "haltère"), equipment: "haltères" });
  }
  if (/trx|suspension/i.test(e.name) && !(ctx.equipItems as any).trx) {
    return swap(e, bodyOrBand("Tirage élastique / serviette", ctx, { reps: e.reps || pickBodyweight(ctx.goalKey) }));
  }

  return e;
}
function preferBackFriendly(ex: NormalizedExercise, ctx: Ctx): NormalizedExercise {
  if (/back squat|front squat/i.test(ex.name)) return dumbbell("Goblet Squat", ctx);
  if (/soulevé de terre/i.test(ex.name)) return dumbbell("Hip Thrust (haltère)", ctx);
  if (/row à la barre/i.test(ex.name)) return dumbbell("Rowing unilatéral", ctx, "dos", { reps: "10–12/ côté" });
  return ex;
}
function swap(_old: NormalizedExercise, replacement: NormalizedExercise): NormalizedExercise { return { ...replacement }; }
function joinNotes(a?: string, b?: string) { if (!a) return b || ""; if (!b) return a || ""; return `${a} ${b}`.trim(); }

/* ========================= Exercices helpers ========================= */
function setsFor(level: "debutant" | "intermediaire" | "avance", bw = false) {
  if (bw) return level === "avance" ? 4 : 3;
  return level === "avance" ? 4 : level === "intermediaire" ? 3 : 2;
}
function rirFor(level: "debutant" | "intermediaire" | "avance") { return level === "avance" ? 1 : 2; }
function tempoFor(goal: string) {
  const g = goal.toLowerCase();
  if (g === "hypertrophy") return "3011";
  if (g === "strength") return "21X1";
  return "2011";
}
function repsFor(goal: string) {
  const g = goal.toLowerCase();
  if (g === "strength") return "4–6";
  if (g === "hypertrophy") return "8–12";
  if (g === "fatloss") return "10–15";
  if (g === "endurance") return "12–15";
  if (g === "mobility") return "8–10";
  return "8–12";
}
function pickBodyweight(goal: string) {
  const g = goal.toLowerCase();
  if (g === "strength") return "6–8";
  if (g === "fatloss") return "12–20";
  return "10–15";
}

/* ====== Factories ====== */
function barbell(name: string, ctx: Ctx, _area?: "bas" | "haut" | "dos", extra?: Partial<NormalizedExercise>): NormalizedExercise {
  return { name, sets: setsFor(ctx.level), reps: repsFor(ctx.goalKey), rest: "90s", tempo: tempoFor(ctx.goalKey), rir: rirFor(ctx.level), block: "principal", equipment: "barre", ...extra };
}
function dumbbell(name: string, ctx: Ctx, _area?: "bas" | "haut" | "dos", extra?: Partial<NormalizedExercise>): NormalizedExercise {
  return { name, sets: setsFor(ctx.level), reps: repsFor(ctx.goalKey), rest: "75s", tempo: tempoFor(ctx.goalKey), rir: rirFor(ctx.level), block: "principal", equipment: "haltères", ...extra };
}
function cableOrMachine(name: string, ctx: Ctx, _area?: "bas" | "haut" | "dos", extra?: Partial<NormalizedExercise>): NormalizedExercise {
  return { name, sets: setsFor(ctx.level), reps: repsFor(ctx.goalKey), rest: "75–90s", tempo: tempoFor(ctx.goalKey), rir: rirFor(ctx.level), block: "principal", equipment: "machine/câble", ...extra };
}
function bodyOrBand(name: string, ctx: Ctx, extra?: Partial<NormalizedExercise>): NormalizedExercise {
  return { name, sets: setsFor(ctx.level, true), reps: extra?.reps || pickBodyweight(ctx.goalKey), rest: "60–75s", block: "principal", equipment: "poids du corps / élastiques", ...extra };
}
function body(name: string, ctx: Ctx, extra?: Partial<NormalizedExercise>): NormalizedExercise {
  return { name, sets: setsFor(ctx.level, true), reps: extra?.reps || pickBodyweight(ctx.goalKey), rest: "60s", block: "principal", equipment: "poids du corps", ...extra };
}

/* ========================= Divers utils (email/timestamp) ========================= */
function normalizeEmail(raw?: string | null) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  return s
    .replace(/@glmail\./g, "@gmail.")
    .replace(/@gmai(l)?\./g, "@gmail.")
    .replace(/@gnail\./g, "@gmail.")
    .replace(/@hotnail\./g, "@hotmail.")
    .replace(/\s+/g, "");
}
function extractTimestampAny(a: any): number {
  const candidates = [a?.timestamp, a?.ts, a?.createdAt, a?.date, a?.Date, a?.A, a?.["A"], a?.["Horodatage"], a?.["horodatage"]];
  for (const v of candidates) {
    if (!v) continue;
    const d = typeof v === "number" ? new Date(v) : new Date(String(v));
    const t = d.getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}
