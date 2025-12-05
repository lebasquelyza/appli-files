// apps/web/lib/coach/beton/core.ts
import type {
  AiSession as AiSessionT,
  WorkoutType,
  NormalizedExercise,
} from "../ai";

/* ========================= Types & Options ========================= */
export type PlanOptions = {
  today?: Date;
  maxSessions?: number;
  /** Langue d'affichage des titres */
  lang?: "fr" | "en";
};

export type ProfileInput = {
  prenom?: string;
  age?: number;
  objectif?: string;
  goal?: string;
  equipLevel?: "none" | "limited" | "full";
  timePerSession?: number;
  level?: "debutant" | "intermediaire" | "avance";
  injuries?: string[];
  equipItems?: string[];
  availabilityText?: string;
  email?: string;
  likes?: string[];
  dislikes?: string[];
  /** Langue éventuelle passée dans le profil */
  lang?: "fr" | "en";
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

const FOCUS_LABEL_EN: Record<StrengthFocus, string> = {
  full: "Full body",
  bas_quads: "Lower (quads)",
  bas_iscios_glutes: "Lower (hamstrings/glutes)",
  haut_push: "Upper (push)",
  haut_pull: "Upper (pull)",
  haut_mix: "Upper (mixed)",
  bras_core: "Arms & core",
};

function focusLabelIntl(f: StrengthFocus, lang: "fr" | "en"): string {
  return lang === "en" ? FOCUS_LABEL_EN[f] : FOCUS_LABEL[f];
}

function makeFocusPlan(n: number, goalKey: string): StrengthFocus[] {
  const g = (goalKey || "general").toLowerCase();
  if (g === "hypertrophy") {
    if (n <= 1) return ["full"];
    if (n === 2) return ["bas_iscios_glutes", "haut_mix"];
    if (n === 3) return ["bas_quads", "haut_push", "haut_pull"];
    if (n === 4)
      return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull"];
    if (n === 5)
      return [
        "bas_quads",
        "haut_push",
        "bas_iscios_glutes",
        "haut_pull",
        "bras_core",
      ];
    return [
      "bas_quads",
      "haut_push",
      "bas_iscios_glutes",
      "haut_pull",
      "bras_core",
      "full",
    ];
  }
  if (g === "strength") {
    if (n <= 1) return ["full"];
    if (n === 2) return ["bas_quads", "haut_push"];
    if (n === 3) return ["bas_quads", "haut_pull", "haut_push"];
    if (n === 4)
      return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull"];
    if (n === 5)
      return [
        "bas_quads",
        "haut_push",
        "bas_iscios_glutes",
        "haut_pull",
        "full",
      ];
    return [
      "bas_quads",
      "haut_push",
      "bas_iscios_glutes",
      "haut_pull",
      "full",
      "full",
    ];
  }
  if (g === "fatloss") {
    if (n <= 1) return ["full"];
    if (n === 2) return ["bas_iscios_glutes", "haut_mix"];
    if (n === 3) return ["full", "haut_mix", "bas_quads"];
    if (n === 4)
      return ["bas_quads", "haut_mix", "bas_iscios_glutes", "haut_pull"];
    if (n === 5)
      return [
        "bas_quads",
        "haut_mix",
        "bas_iscios_glutes",
        "haut_pull",
        "full",
      ];
    return [
      "bas_quads",
      "haut_mix",
      "bas_iscios_glutes",
      "haut_pull",
      "full",
      "full",
    ];
  }
  if (n <= 1) return ["full"];
  if (n === 2) return ["bas_iscios_glutes", "haut_mix"];
  if (n === 3) return ["bas_quads", "haut_push", "haut_pull"];
  if (n === 4)
    return ["bas_quads", "haut_push", "bas_iscios_glutes", "haut_pull"];
  if (n === 5)
    return [
      "bas_quads",
      "haut_push",
      "bas_iscios_glutes",
      "haut_pull",
      "full",
    ];
  return [
    "bas_quads",
    "haut_push",
    "bas_iscios_glutes",
    "haut_pull",
    "full",
    "haut_mix",
  ];
}

/* ========================= API principale ========================= */
type Lang = "fr" | "en";

export function planProgrammeFromProfile(
  profile: ProfileInput = {},
  opts?: PlanOptions,
): { sessions: AiSessionT[] } {
  const { today = new Date(), maxSessions: maxOpt } = opts ?? {};

  // 🔤 Langue d'affichage
  const lang: Lang =
    opts?.lang === "en" || profile.lang === "en" ? "en" : "fr";

  const inferred = inferMaxSessions(profile.availabilityText);
  const maxSessions = clamp(maxOpt ?? inferred ?? 3, 1, 6);

  const minutes = clamp(
    profile.timePerSession ?? defaultTime(profile.goal),
    20,
    90,
  );
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
    const focus: StrengthFocus | undefined =
      type === "muscu" ? focusPlan[i % focusPlan.length] : undefined;
    const focusSuffix = focus
      ? ` · ${focusLabelIntl(focus, lang)}`
      : "";

    const baseTitle = baseTitleForType(type, lang);

    let title: string;
    if (lang === "en") {
      if (profile.prenom) {
        title = singleNoDay
          ? `Workout for ${profile.prenom}${focusSuffix}`
          : `Workout for ${profile.prenom} — ${dayLabel}${focusSuffix}`;
      } else {
        title = singleNoDay
          ? `${baseTitle}${focusSuffix}`
          : `${baseTitle} — ${dayLabel}${focusSuffix}`;
      }
    } else {
      title = profile.prenom
        ? singleNoDay
          ? `Séance pour ${profile.prenom}${focusSuffix}`
          : `Séance pour ${profile.prenom} — ${dayLabel}${focusSuffix}`
        : singleNoDay
        ? `${baseTitle}${focusSuffix}`
        : `${baseTitle} — ${dayLabel}${focusSuffix}`;
    }

    const exos =
      type === "cardio"
        ? buildCardio(ctx, variant)
        : type === "mobilité"
        ? buildMobility(ctx)
        : type === "hiit"
        ? buildHiit(ctx)
        : buildStrengthFocused(ctx, focus ?? "full", goalKey, profile);

    const intensity =
      lang === "en"
        ? type === "hiit"
          ? "high"
          : "moderate"
        : type === "hiit"
        ? "élevée"
        : "modérée";

    sessions.push({
      id: `beton-${dateStr}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      type: type as WorkoutType,
      date: dateStr,
      plannedMin: minutes,
      intensity,
      exercises: exos,
    } as AiSessionT);
  }

  return { sessions };
}

/* ========================= Inférence nb séances & jours ========================= */
const DAYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

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
  const push = (d: string) => {
    if (!out.includes(d)) out.push(d);
  };
  if (/week\s*-?\s*end|weekend/.test(s)) {
    push("samedi");
    push("dimanche");
  }
  for (const d of DAYS)
    if (new RegExp(`\\b${d}\\b`, "i").test(s)) push(d);
  return out;
}

function capitalize(str: string) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function defaultBaseTitle(t: WorkoutType) {
  return t === "cardio"
    ? "Cardio"
    : t === "mobilité"
    ? "Mobilité"
    : t === "hiit"
    ? "HIIT"
    : "Muscu";
}

function baseTitleForType(t: WorkoutType, lang: Lang) {
  if (lang === "en") {
    if (t === "cardio") return "Cardio";
    if (t === "mobilité") return "Mobility";
    if (t === "hiit") return "HIIT";
    return "Strength training";
  }
  return defaultBaseTitle(t);
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
type Injuries = {
  back?: boolean;
  shoulder?: boolean;
  knee?: boolean;
  wrist?: boolean;
  hip?: boolean;
  ankle?: boolean;
  elbow?: boolean;
};
type Items = {
  bands?: boolean;
  kb?: boolean;
  trx?: boolean;
  bench?: boolean;
  bar?: boolean;
  db?: boolean;
  bike?: boolean;
  rower?: boolean;
  treadmill?: boolean;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function defaultTime(goal?: string) {
  switch ((goal ?? "").toLowerCase()) {
    case "endurance":
      return 35;
    case "mobility":
      return 25;
    case "fatloss":
      return 35;
    default:
      return 45;
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

/* ========================= Cardio / Mobility / HIIT ========================= */
function buildCardio(ctx: Ctx, variantIdx: number): NormalizedExercise[] {
  const { minutes, equipItems } = ctx;
  const warm = {
    name: "Échauffement Z1",
    reps: "8–10 min",
    block: "echauffement",
  } as NormalizedExercise;
  const cool = {
    name: "Retour au calme + mobilité",
    reps: "5–8 min",
    block: "fin",
  } as NormalizedExercise;
  const main: NormalizedExercise =
    variantIdx % 2 === 0
      ? {
          name: equipItems.bike
            ? "Vélo Z2 continu"
            : equipItems.rower
            ? "Rameur Z2 continu"
            : "Z2 continu",
          reps: `${Math.max(15, minutes - 12)} min`,
          block: "principal",
        }
      : {
          name: equipItems.treadmill
            ? "Fractionné Z2/Z3 sur tapis"
            : "Fractionné Z2/Z3",
          reps: "12×(1’/1’)",
          block: "principal",
        };
  return [warm, main, cool];
}

function buildMobility(_ctx: Ctx): NormalizedExercise[] {
  return [
    {
      name: "Respiration diaphragmatique",
      reps: "2–3 min",
      block: "echauffement",
    },
    { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
    {
      name: "T-spine rotations",
      reps: "8–10/ côté",
      block: "principal",
    },
    { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
  ];
}

function buildHiit(ctx: Ctx): NormalizedExercise[] {
  return [
    {
      name: "Air Squats",
      reps: "40s",
      rest: "20s",
      block: "principal",
    },
    {
      name: "Mountain Climbers",
      reps: "40s",
      rest: "20s",
      block: "principal",
    },
    adjustForInjuries(ctx, {
      name: "Burpees (option sans saut)",
      reps: "30–40s",
      rest: "30–40s",
      block: "principal",
      notes: "Retire le saut/impact si genoux sensibles.",
    }),
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
    {
      name: "Tirage vertical",
      need: ["machine", "bands"],
      area: "dos",
      kind: "main",
      fallback: "Tirage élastique",
    },
    {
      name: "Développé haltères",
      need: ["db"],
      area: "haut",
      kind: "assist",
      fallback: "Pompes surélevées",
    },
    {
      name: "Élévations latérales",
      need: ["db", "bands"],
      area: "haut",
      kind: "iso",
    },
    {
      name: "Curl biceps (élastique/haltères)",
      need: ["db", "bands"],
      area: "haut",
      kind: "iso",
    },
  ],
  bas_quads: [
    {
      name: "Front Squat",
      need: ["bar"],
      area: "bas",
      kind: "main",
      fallback: "Goblet Squat",
      contra: (i) => !!i.back,
    },
    {
      name: "Presse à cuisses",
      need: ["machine"],
      area: "bas",
      kind: "assist",
      fallback: "Fente arrière",
    },
    { name: "Fente arrière", area: "bas", kind: "assist" },
    {
      name: "Leg Extension (élastique/machine)",
      need: ["machine", "bands"],
      area: "bas",
      kind: "iso",
      fallback: "Squat partiel",
    },
  ],
  bas_iscios_glutes: [
    {
      name: "Hip Thrust (barre/haltère)",
      need: ["bench"],
      area: "bas",
      kind: "main",
      fallback: "Hip Thrust au sol",
    },
    {
      name: "Soulevé de terre roumain",
      need: ["bar"],
      area: "bas",
      kind: "main",
      fallback: "RDL haltères",
      contra: (i) => !!i.back,
    },
    {
      name: "Good Morning haltères",
      need: ["db"],
      area: "bas",
      kind: "assist",
      fallback: "Pont fessier",
    },
    {
      name: "Leg Curl (élastique)",
      need: ["bands"],
      area: "bas",
      kind: "iso",
      fallback: "Nordic curl assisté",
    },
    {
      name: "Abduction hanches (élastique)",
      need: ["bands"],
      area: "bas",
      kind: "iso",
    },
  ],
  haut_push: [
    {
      name: "Bench Press",
      need: ["bar", "bench"],
      area: "haut",
      kind: "main",
      fallback: "Développé haltères",
      contra: (i) => !!i.shoulder,
    },
    {
      name: "Développé haltères incliné",
      need: ["db"],
      area: "haut",
      kind: "main",
      fallback: "Pompes surélevées",
    },
    {
      name: "Élévations latérales",
      need: ["db", "bands"],
      area: "haut",
      kind: "iso",
    },
    {
      name: "Triceps extension (poulie/élastique)",
      need: ["machine", "bands"],
      area: "haut",
      kind: "iso",
      fallback: "Extension triceps haltères",
    },
    {
      name: "Écartés (haltères/élastique)",
      need: ["db", "bands"],
      area: "haut",
      kind: "iso",
    },
  ],
  haut_pull: [
    {
      name: "Tractions / Tirage vertical",
      need: ["machine", "bands"],
      area: "dos",
      kind: "main",
      fallback: "Tirage élastique",
    },
    {
      name: "Rowing unilatéral",
      need: ["db"],
      area: "dos",
      kind: "main",
      fallback: "Row avec serviette/table",
    },
    {
      name: "Face Pull (câble/élastique)",
      need: ["machine", "bands"],
      area: "dos",
      kind: "assist",
      fallback: "Tirage horizontal élastique",
    },
    {
      name: "Curl biceps (haltères/élastique)",
      need: ["db", "bands"],
      area: "haut",
      kind: "iso",
    },
  ],
  haut_mix: [
    {
      name: "Développé haltères",
      need: ["db"],
      area: "haut",
      kind: "main",
      fallback: "Pompes surélevées",
    },
    {
      name: "Rowing buste penché",
      need: ["db"],
      area: "dos",
      kind: "main",
      fallback: "Tirage élastique",
    },
    { name: "Pompes surélevées", area: "haut", kind: "assist" },
    {
      name: "Élévations latérales",
      need: ["db", "bands"],
      area: "haut",
      kind: "iso",
    },
    {
      name: "Curl incliné (haltères)",
      need: ["db"],
      area: "haut",
      kind: "iso",
    },
  ],
  bras_core: [
    {
      name: "Curl biceps (haltères/élastique)",
      need: ["db", "bands"],
      area: "haut",
      kind: "iso",
    },
    {
      name: "Extension triceps (poulie/élastique)",
      need: ["machine", "bands"],
      area: "haut",
      kind: "iso",
      fallback: "Extension triceps haltères",
    },
    { name: "Hollow Hold", area: "haut", kind: "core" },
    {
      name: "Side Plank (gauche/droite)",
      area: "haut",
      kind: "core",
    },
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
function hasEquipment(
  ctx: Ctx,
  need: "bar" | "db" | "bench" | "machine" | "kb" | "bands" | "trx",
) {
  if (ctx.equip === "full") return true;
  switch (need) {
    case "db":
      return !!ctx.equipItems.db;
    case "bar":
      return !!ctx.equipItems.bar;
    case "bench":
      return !!ctx.equipItems.bench;
    case "machine":
      return false;
    case "kb":
      return !!ctx.equipItems.kb;
    case "bands":
      return !!ctx.equipItems.bands;
    case "trx":
      return !!ctx.equipItems.trx;
    default:
      return false;
  }
}
function matchesPreference(name: string, list?: string[]) {
  if (!list || list.length === 0) return false;
  const n = name.toLowerCase();
  return list.some((k) => n.includes(k.toLowerCase()));
}
function estimateTotalMinutes(list: NormalizedExercise[], goal: string) {
  return list.reduce(
    (sum, e) => sum + estimateExerciseMinutes(e, goal),
    0,
  );
}

/* ========================= Musculation ========================= */
function buildStrengthFocused(
  ctx: Ctx,
  focus: StrengthFocus,
  goalKey: string,
  profile?: ProfileInput,
): NormalizedExercise[] {
  const g = (goalKey || "general").toLowerCase();
  const out: NormalizedExercise[] = [];

  out.push({
    name: focus.startsWith("bas")
      ? "Activation hanches/chevilles"
      : "Activation épaules/omoplates",
    reps: "3–5 min",
    block: "echauffement",
  });

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

  const kindRank: Record<
    NonNullable<PoolItem["kind"]>,
    number
  > = { main: 0, assist: 1, iso: 2, core: 3 };
  filtered.sort((a, b) => {
    const likeA = matchesPreference(a.name, likes) ? -1 : 0;
    const likeB = matchesPreference(b.name, likes) ? -1 : 0;
    if (likeA !== likeB) return likeA - likeB;
    return (
      (kindRank[a.kind || "assist"] ?? 9) -
      (kindRank[b.kind || "assist"] ?? 9)
    );
  });

  const targetMin = clamp(ctx.minutes, 20, 90);
  let usedMin = 0;

  for (const p of filtered) {
    const usableName =
      p.need && !p.need.every((n) => hasEquipment(ctx, n))
        ? p.fallback || p.name
        : p.name;

    const isBW = /pompes|hollow|plank|pont|tirage élastique|traction|row.*serviette/i.test(
      usableName,
    );
    const isMain = p.kind === "main";

    const base: NormalizedExercise = {
      name: usableName,
      sets: defaultSets(ctx.level, isBW),
      reps: defaultReps(g, isMain),
      rest:
        g === "strength"
          ? "120–150s"
          : g === "fatloss"
          ? "45–60s"
          : isMain
          ? "75–90s"
          : "60–75s",
      tempo: tempoFor(ctx.goalKey),
      rir: rirFor(ctx.level),
      block: "principal",
    };

    const mins = estimateExerciseMinutes(base, g);
    if (usedMin + mins > targetMin + 4) continue;

    out.push(adjustForInjuries(ctx, base));
    usedMin += mins;

    const mains = out.filter((e) =>
      /Squat|Presse|Soulevé|Développé|Row(?!.*serviette)|Tirage|Tractions|Hip Thrust|Bench/i.test(
        e.name,
      ),
    ).length;

    if (usedMin >= targetMin * 0.7 && mains >= 3) {
      if (targetMin - usedMin >= 5) {
        out.push(
          adjustForInjuries(ctx, {
            name: "Gainage planche",
            sets: 2,
            reps: "30–45s",
            rest: g === "fatloss" ? "30–45s" : "45–60s",
            block: "fin",
          }),
        );
      }
      break;
    }
    if (usedMin >= targetMin - 2) break;
  }

  if (estimateTotalMinutes(out, g) < targetMin - 6) {
    out.push(
      adjustForInjuries(ctx, {
        name: "Side Plank (gauche/droite)",
        sets: 2,
        reps: "20–30s/ côté",
        rest: "45s",
        block: "fin",
      }),
    );
  }

  return out;
}

/* ========================= Ajustements blessures/items ========================= */
function adjustForInjuries(
  ctx: Ctx,
  ex: NormalizedExercise,
): NormalizedExercise {
  const e: NormalizedExercise = { ...ex };

  if (e.sets && !e.rir) e.rir = rirFor(ctx.level);
  if (e.sets && !e.tempo) e.tempo = tempoFor(ctx.goalKey);

  if (ctx.injuries.back) {
    if (
      /back squat|soulevé de terre|deadlift|row à la barre/i.test(
        e.name,
      )
    ) {
      return swap(e, preferBackFriendly(e, ctx));
    }
    if (/superman/i.test(e.name)) {
      e.notes = joinNotes(
        e.notes,
        "Si gêne au dos, réduire l’amplitude ou remplacer par Bird-Dog.",
      );
    }
  }
  if (ctx.injuries.shoulder) {
    if (
      /militaire|overhead|développé militaire|élevations latérales lourdes/i.test(
        e.name,
      )
    ) {
      return swap(e, {
        name: "Développé haltères neutre",
        sets: e.sets ?? 3,
        reps: repsFor(ctx.goalKey),
        rest: "75s",
        block: e.block,
        equipment: "haltères",
        notes: "Prise neutre, amplitude confortable.",
      });
    }
    if (/dips/i.test(e.name)) {
      return swap(e, {
        name: "Pompes surélevées",
        sets: e.sets ?? 3,
        reps: pickBodyweight(ctx.goalKey),
        rest: "60–75s",
        block: "principal",
        equipment: "poids du corps",
      });
    }
  }
  if (ctx.injuries.knee) {
    if (/sauté|jump|burpee/i.test(e.name)) {
      return swap(e, {
        name: "Marche rapide / step-ups bas",
        sets: e.sets ?? 3,
        reps: "10–12/ côté",
        rest: "60s",
        block: "principal",
        notes: "Hauteur basse, sans douleur.",
      });
    }
    if (/squat(?!.*goblet)|fente/i.test(e.name)) {
      e.notes = joinNotes(
        e.notes,
        "Amplitude contrôlée, pas de douleur, option appui/assistance.",
      );
    }
  }
  if (ctx.injuries.wrist && /pompes|push-up/i.test(e.name)) {
    e.notes = joinNotes(
      e.notes,
      "Utiliser poignées de pompe ou poings fermés pour garder le poignet neutre.",
    );
  }
  if (ctx.injuries.hip && /squat|fente/i.test(e.name)) {
    e.notes = joinNotes(
      e.notes,
      "Amplitude confortable, focus stabilité hanche.",
    );
  }
  if (ctx.injuries.ankle && /sauté|jump/i.test(e.name)) {
    return swap(e, {
      name: "Marche rapide inclinée",
      sets: e.sets ?? 3,
      reps: "2–3 min",
      rest: "60s",
      block: "principal",
    });
  }

  if (/kettlebell|kb/i.test(e.name) && !(ctx.equipItems as any).kb) {
    return swap(e, {
      ...e,
      name: e.name.replace(/kettlebell|KB/i, "haltère"),
      equipment: "haltères",
    });
  }
  if (/trx|suspension/i.test(e.name) && !(ctx.equipItems as any).trx) {
    return swap(
      e,
      bodyOrBand("Tirage élastique / serviette", ctx, {
        reps: e.reps || pickBodyweight(ctx.goalKey),
      }),
    );
  }

  return e;
}

function preferBackFriendly(
  ex: NormalizedExercise,
  ctx: Ctx,
): NormalizedExercise {
  if (/back squat|front squat/i.test(ex.name))
    return dumbbell("Goblet Squat", ctx);
  if (/soulevé de terre/i.test(ex.name))
    return dumbbell("Hip Thrust (haltère)", ctx);
  if (/row à la barre/i.test(ex.name))
    return dumbbell("Rowing unilatéral", ctx, "dos", {
      reps: "10–12/ côté",
    });
  return ex;
}

function swap(
  _old: NormalizedExercise,
  replacement: NormalizedExercise,
): NormalizedExercise {
  return { ...replacement };
}
function joinNotes(a?: string, b?: string) {
  if (!a) return b || "";
  if (!b) return a || "";
  return `${a} ${b}`.trim();
}

/* ========================= Exercices helpers ========================= */
function setsFor(
  level: "debutant" | "intermediaire" | "avance",
  bw = false,
) {
  if (bw) return level === "avance" ? 4 : 3;
  return level === "avance"
    ? 4
    : level === "intermediaire"
    ? 3
    : 2;
}
function rirFor(level: "debutant" | "intermediaire" | "avance") {
  return level === "avance" ? 1 : 2;
}
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
function barbell(
  name: string,
  ctx: Ctx,
  _area?: any,
  extra?: Partial<NormalizedExercise>,
): NormalizedExercise {
  return {
    name,
    sets: setsFor(ctx.level),
    reps: repsFor(ctx.goalKey),
    rest: "90s",
    tempo: tempoFor(ctx.goalKey),
    rir: rirFor(ctx.level),
    block: "principal",
    equipment: "barre",
    ...extra,
  };
}
function dumbbell(
  name: string,
  ctx: Ctx,
  _area?: any,
  extra?: Partial<NormalizedExercise>,
): NormalizedExercise {
  return {
    name,
    sets: setsFor(ctx.level),
    reps: repsFor(ctx.goalKey),
    rest: "75s",
    tempo: tempoFor(ctx.goalKey),
    rir: rirFor(ctx.level),
    block: "principal",
    equipment: "haltères",
    ...extra,
  };
}
function cableOrMachine(
  name: string,
  ctx: Ctx,
  _area?: any,
  extra?: Partial<NormalizedExercise>,
): NormalizedExercise {
  return {
    name,
    sets: setsFor(ctx.level),
    reps: repsFor(ctx.goalKey),
    rest: "75–90s",
    tempo: tempoFor(ctx.goalKey),
    rir: rirFor(ctx.level),
    block: "principal",
    equipment: "machine/câble",
    ...extra,
  };
}
function bodyOrBand(
  name: string,
  ctx: Ctx,
  extra?: Partial<NormalizedExercise>,
): NormalizedExercise {
  return {
    name,
    sets: setsFor(ctx.level, true),
    reps: extra?.reps || pickBodyweight(ctx.goalKey),
    rest: "60–75s",
    block: "principal",
    equipment: "poids du corps / élastiques",
    ...extra,
  };
}
function body(
  name: string,
  ctx: Ctx,
  extra?: Partial<NormalizedExercise>,
): NormalizedExercise {
  return {
    name,
    sets: setsFor(ctx.level, true),
    reps: extra?.reps || pickBodyweight(ctx.goalKey),
    rest: "60s",
    block: "principal",
    equipment: "poids du corps",
    ...extra,
  };
}
