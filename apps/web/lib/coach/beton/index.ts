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
  injuries?: string[]; // ex: ["dos","epaules","genoux"]
  equipItems?: string[]; // ex: ["élastiques","kettlebell","trx"]
  /** Texte libre de dispo: “lundi mardi”, “week-end”, “6 jours par semaine”, “3x”, etc. */
  availabilityText?: string;
  email?: string;
};

/* ========================= API principale ========================= */
export function planProgrammeFromProfile(
  profile: ProfileInput = {},
  opts?: PlanOptions
): { sessions: AiSessionT[] } {
  const { today = new Date(), maxSessions: maxOpt } = opts ?? {};

  // Inférer le nb de séances depuis le texte de disponibilités si maxSessions non fourni
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

  // Jours explicites à afficher dans les titres (Lundi, Mardi...), sinon fallback A/B/C
  const daysList = extractDaysList(profile.availabilityText);

  const sessions: AiSessionT[] = [];
  for (let i = 0; i < maxSessions; i++) {
    const d = addDays(today, i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    const variant = i % 3; // A/B/C
    const labelABC = ["A", "B", "C"][variant];

    // Titre logique
    const dayLabel = daysList[i] ? capitalize(daysList[i]) : labelABC;
    const singleNoDay = maxSessions === 1 && daysList.length === 0;

    const title = profile.prenom
      ? singleNoDay
        ? `Séance pour ${profile.prenom}`
        : `Séance pour ${profile.prenom} — ${dayLabel}`
      : singleNoDay
      ? defaultBaseTitle(type)
      : `${defaultBaseTitle(type)} — ${dayLabel}`;

    const exos =
      type === "cardio"
        ? buildCardio(ctx, variant)
        : type === "mobilité"
        ? buildMobility(ctx)
        : type === "hiit"
        ? buildHiit(ctx)
        : buildStrength(ctx, variant); // muscu

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

/* ========================= Génération depuis le Sheet (optionnel) ========================= */
/** Extrait un texte de dispo depuis une ligne de réponses (scan large des valeurs texte). */
function availabilityTextFromAnswers(answers: any): string | undefined {
  if (!answers) return undefined;
  const dayPat =
    /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week\s*-?\s*end|weekend|jours?\s+par\s+semaine|\b\d+\s*(x|fois|jours?))/i;

  const candidates: string[] = [];
  // prioriser colonnes “classiques”
  for (const k of ["daysPerWeek", "jours", "séances/semaine", "seances/semaine", "col_I"]) {
    const v = answers[k];
    if (typeof v === "string") candidates.push(v);
  }
  // puis scanner toutes les valeurs texte
  for (const k of Object.keys(answers)) {
    const v = answers[k];
    if (typeof v === "string") candidates.push(v);
  }
  const hits = candidates
    .map((v) => String(v ?? "").trim())
    .filter((v) => v && dayPat.test(v));

  return hits.length ? hits.join(" ; ") : undefined;
}

/** Génère via email → récupère la DERNIÈRE réponse + logique jours→séances */
export async function planProgrammeFromEmail(
  email: string,
  opts: PlanOptions = {}
): Promise<{ sessions: AiSessionT[]; profile: Partial<ProfileT> }> {
  const cleanEmail = normalizeEmail(email);
  const res = await _getAnswersForEmail(cleanEmail);
  const last = Array.isArray(res)
    ? res.slice().sort((a, b) => extractTimestampAny(a) - extractTimestampAny(b)).at(-1) ?? res[0]
    : res;

  let built: Partial<ProfileT> & { availabilityText?: string } = {};
  if (last) {
    built = (_buildProfileFromAnswers(last) || {}) as Partial<ProfileT> & { availabilityText?: string };
    built.availabilityText = built.availabilityText || availabilityTextFromAnswers(last);
  } else {
    built = { email: cleanEmail } as Partial<ProfileT>;
  }

  const inferred = inferMaxSessions(built.availabilityText);
  const maxSessions = clamp(opts.maxSessions ?? inferred ?? 3, 1, 6);
  const { sessions } = planProgrammeFromProfile(built as unknown as ProfileInput, {
    ...opts,
    maxSessions,
  });
  return { sessions, profile: built };
}

/** Génère si on a déjà l’objet answers (batch) */
export function planProgrammeFromAnswers(
  answers: any,
  opts: PlanOptions = {}
): { sessions: AiSessionT[]; profile: Partial<ProfileT> } {
  const built = (_buildProfileFromAnswers(answers) || {}) as Partial<ProfileT> & {
    availabilityText?: string;
  };
  const availability = built.availabilityText || availabilityTextFromAnswers(answers);
  const inferred = inferMaxSessions(availability);
  const maxSessions = clamp(opts.maxSessions ?? inferred ?? 3, 1, 6);
  const { sessions } = planProgrammeFromProfile(built as unknown as ProfileInput, {
    ...opts,
    maxSessions,
  });
  return { sessions, profile: built };
}

/* ========================= Inférence du nb de séances & Jours ========================= */
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function inferMaxSessions(text?: string | null): number | undefined {
  if (!text) return undefined;
  const s = String(text).toLowerCase();

  // Ex: "6x", "6 x", "6 jours", "3 jours par semaine"
  const numMatch = s.match(/\b(\d{1,2})\s*(x|fois|jours?)\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (!Number.isNaN(n)) return clamp(n, 1, 6);
  }

  // "toute la semaine" / "tous les jours" → 6 (borne 6)
  if (/toute?\s+la\s+semaine|tous?\s+les\s+jours/.test(s)) return 6;

  // Compte des jours explicites + week-end
  const days = extractDaysList(s);
  if (days.length) return clamp(days.length, 1, 6);

  return undefined;
}

/** Retourne la liste ordonnée des jours trouvés dans le texte (week-end → samedi+dimanche). */
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
  for (const d of DAYS) {
    if (new RegExp(`\\b${d}\\b`, "i").test(s)) push(d);
  }
  return out;
}

function capitalize(str: string) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function defaultBaseTitle(t: WorkoutType) {
  return t === "cardio" ? "Cardio" : t === "mobilité" ? "Mobilité" : t === "hiit" ? "HIIT" : "Muscu";
}

/* ========================= Contexte & utils ========================= */
type Ctx = {
  level: "debutant" | "intermediaire" | "avance";
  equip: "none" | "limited" | "full";
  minutes: number;
  goalKey: string;
  injuries: Injuries; // set normalisé
  equipItems: Items; // set normalisé
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
  bands?: boolean; // élastiques
  kb?: boolean; // kettlebell
  trx?: boolean;
  bench?: boolean;
  bar?: boolean;
  db?: boolean; // haltères
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

/* ========================= Builders par type ========================= */
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
  // Adapter si genoux sensibles → retrait des sauts
  out.push(
    adjustForInjuries(ctx, {
      name: "Burpees (option sans saut)",
      reps: "30–40s",
      rest: "30–40s",
      block: "principal",
      notes: "Retire le saut/impact si genoux sensibles.",
    })
  );
  return out;
}

/* ========================= Musculation (A/B/C) ========================= */
function buildStrength(ctx: Ctx, variantIdx: number): NormalizedExercise[] {
  const { equip } = ctx;
  const out: NormalizedExercise[] = [];

  // Échauffement
  out.push({ name: "Mobilité dynamique (hanches/épaules)", reps: "3–5 min", block: "echauffement" });

  if (equip === "full") {
    if (variantIdx === 0) {
      out.push(adjustForInjuries(ctx, barbell("Back Squat", ctx)));
      out.push(adjustForInjuries(ctx, barbell("Bench Press", ctx, "haut")));
      out.push(adjustForInjuries(ctx, barbell("Row à la barre", ctx, "dos")));
    } else if (variantIdx === 1) {
      out.push(
        adjustForInjuries(ctx, barbell("Soulevé de terre (technique)", ctx, "dos", { notes: "Charge modérée, technique propre." }))
      );
      out.push(adjustForInjuries(ctx, cableOrMachine("Tirage vertical", ctx, "dos")));
      out.push(adjustForInjuries(ctx, barbell("Développé militaire", ctx, "haut")));
    } else {
      out.push(adjustForInjuries(ctx, barbell("Front Squat", ctx)));
      out.push(adjustForInjuries(ctx, dumbbell("Développé haltères incliné", ctx, "haut")));
      out.push(adjustForInjuries(ctx, cableOrMachine("Tractions assistées / Tirage poulie", ctx, "dos")));
    }
  } else if (equip === "limited") {
    if (variantIdx === 0) {
      out.push(adjustForInjuries(ctx, dumbbell("Goblet Squat", ctx)));
      out.push(adjustForInjuries(ctx, dumbbell("Développé haltères", ctx, "haut")));
      out.push(adjustForInjuries(ctx, dumbbell("Rowing unilatéral", ctx, "dos", { reps: "10–12/ côté" })));
    } else if (variantIdx === 1) {
      out.push(adjustForInjuries(ctx, dumbbell("Fente arrière", ctx, undefined, { reps: "8–12/ côté" })));
      out.push(adjustForInjuries(ctx, dumbbell("Élévations latérales", ctx, "haut", { reps: "12–15" })));
      out.push(adjustForInjuries(ctx, dumbbell("Rowing buste penché", ctx, "dos")));
    } else {
      out.push(adjustForInjuries(ctx, dumbbell("Hip Thrust (haltère)", ctx)));
      out.push(adjustForInjuries(ctx, bodyOrBand("Pompes surélevées", ctx, { reps: pickBodyweight(ctx.goalKey) })));
      out.push(adjustForInjuries(ctx, dumbbell("Curl + Extension triceps", ctx, undefined, { reps: "10–12" })));
    }
  } else {
    // equip === "none" — poids du corps
    if (variantIdx === 0) {
      out.push(adjustForInjuries(ctx, body("Squat", ctx)));
      out.push(adjustForInjuries(ctx, body("Pompes", ctx)));
      out.push(adjustForInjuries(ctx, bodyOrBand("Row table / tirage élastique", ctx)));
    } else if (variantIdx === 1) {
      out.push(adjustForInjuries(ctx, body("Fente arrière", ctx, { reps: "10–15/ côté" })));
      out.push(adjustForInjuries(ctx, body("Pompes diamant / genoux", ctx, { reps: pickBodyweight(ctx.goalKey) })));
      out.push(adjustForInjuries(ctx, body("Superman hold", ctx, { reps: "20–30s" })));
    } else {
      out.push(adjustForInjuries(ctx, body("Squat sauté (technique)", ctx, { reps: "8–10" })));
      out.push(adjustForInjuries(ctx, body("Dips banc / chaise", ctx, { reps: pickBodyweight(ctx.goalKey) })));
      out.push(adjustForInjuries(ctx, bodyOrBand("Tirage élastique / serviette", ctx, { reps: pickBodyweight(ctx.goalKey) })));
    }
  }

  // Accessoires / tronc
  out.push(adjustForInjuries(ctx, { name: "Gainage planche", sets: 2, reps: "30–45s", rest: "45s", block: "fin" }));
  return out;
}

/* ========================= Ajustements (blessures & items) ========================= */
function adjustForInjuries(ctx: Ctx, ex: NormalizedExercise): NormalizedExercise {
  const e: NormalizedExercise = { ...ex };

  // RIR et tempo adaptés selon objectif/niveau
  if (e.sets && !e.rir) e.rir = rirFor(ctx.level);
  if (e.sets && !e.tempo) e.tempo = tempoFor(ctx.goalKey);

  // Dos sensible
  if (ctx.injuries.back) {
    if (/back squat|soulevé de terre|deadlift|row à la barre/i.test(e.name)) {
      return swap(e, preferBackFriendly(e, ctx));
    }
    if (/superman/i.test(e.name)) {
      e.notes = joinNotes(e.notes, "Si gêne au dos, réduire l’amplitude ou remplacer par Bird-Dog.");
    }
  }
  // Épaules sensibles
  if (ctx.injuries.shoulder) {
    if (/militaire|overhead|développé militaire|élevations latérales lourdes/i.test(e.name)) {
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
        block: e.block,
        equipment: "poids du corps",
      });
    }
  }
  // Genoux sensibles
  if (ctx.injuries.knee) {
    if (/sauté|jump|burpee/i.test(e.name)) {
      return swap(e, {
        name: "Marche rapide / step-ups bas",
        sets: e.sets ?? 3,
        reps: "10–12/ côté",
        rest: "60s",
        block: e.block,
        notes: "Hauteur basse, sans douleur.",
      });
    }
    if (/squat(?!.*goblet)|fente/i.test(e.name)) {
      e.notes = joinNotes(e.notes, "Amplitude contrôlée, pas de douleur, option appui/assistance.");
    }
  }
  // Poignets
  if (ctx.injuries.wrist && /pompes|push-up/i.test(e.name)) {
    e.notes = joinNotes(e.notes, "Utiliser poignées de pompe ou poings fermés pour garder le poignet neutre.");
  }
  // Hanches
  if (ctx.injuries.hip && /squat|fente/i.test(e.name)) {
    e.notes = joinNotes(e.notes, "Amplitude confortable, focus stabilité hanche.");
  }
  // Chevilles
  if (ctx.injuries.ankle && /sauté|jump/i.test(e.name)) {
    return swap(e, { name: "Marche rapide inclinée", sets: e.sets ?? 3, reps: "2–3 min", rest: "60s", block: e.block });
  }

  // Utilisation équipement si dispo
  if (/tirage élastique|row|tirage/i.test(e.name)) {
    if (ctx.equipItems.bands) e.equipment = e.equipment || "élastiques";
  }
  if (/kettlebell|kb/i.test(e.name) && !ctx.equipItems.kb) {
    return swap(e, { ...e, name: e.name.replace(/kettlebell|KB/i, "haltère"), equipment: "haltères" });
  }
  if (/trx|suspension/i.test(e.name) && !ctx.equipItems.trx) {
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

function swap(_old: NormalizedExercise, replacement: NormalizedExercise): NormalizedExercise {
  return { ...replacement };
}
function joinNotes(a?: string, b?: string) {
  if (!a) return b || "";
  if (!b) return a || "";
  return `${a} ${b}`.trim();
}

/* ========================= Exercices helpers ========================= */
function setsFor(level: "debutant" | "intermediaire" | "avance", bw = false) {
  if (bw) return level === "avance" ? 4 : 3;
  return level === "avance" ? 4 : level === "intermediaire" ? 3 : 2;
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

/* ====== Factories ====== */
function barbell(
  name: string,
  ctx: Ctx,
  _area?: "bas" | "haut" | "dos",
  extra?: Partial<NormalizedExercise>
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
  _area?: "bas" | "haut" | "dos",
  extra?: Partial<NormalizedExercise>
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
  _area?: "bas" | "haut" | "dos",
  extra?: Partial<NormalizedExercise>
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
function bodyOrBand(name: string, ctx: Ctx, extra?: Partial<NormalizedExercise>): NormalizedExercise {
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
function body(name: string, ctx: Ctx, extra?: Partial<NormalizedExercise>): NormalizedExercise {
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
  const candidates = [
    a?.timestamp,
    a?.ts,
    a?.createdAt,
    a?.date,
    a?.Date,
    a?.A,
    a?.["A"],
    a?.["Horodatage"],
    a?.["horodatage"],
  ];
  for (const v of candidates) {
    if (!v) continue;
    const d = typeof v === "number" ? new Date(v) : new Date(String(v));
    const t = d.getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

