// apps/web/lib/coach/beton/index.ts
import {
  type AiSession as AiSessionT,
  type WorkoutType,
  type NormalizedExercise,
  // nouveaux imports pour reproduire la logique “Mes infos”
  getAnswersForEmail,
  buildProfileFromAnswers,
  type Profile as ProfileT,
} from "../ai";

/* ========================= Types & Options ========================= */
export type PlanOptions = {
  today?: Date;
  maxSessions?: number; // 1..6 (jours/semaine)
};

type ProfileInput = {
  prenom?: string;
  age?: number;
  objectif?: string;           // libellé brut (affichage)
  goal?: string;               // clé normalisée: hypertrophy|fatloss|strength|endurance|mobility|general
  equipLevel?: "none" | "limited" | "full";
  timePerSession?: number;
  level?: "debutant" | "intermediaire" | "avance";
  injuries?: string[];         // ex: ["dos", "epaules", "genoux"]
  equipItems?: string[];       // ex: ["élastiques","kettlebell","trx"]
  email?: string;
};

/* ========================= Logique “Mes infos” (Sheet) ========================= */
/** mêmes corrections rapides que côté profil */
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
    a?.timestamp, a?.ts, a?.createdAt, a?.date, a?.Date,
    a?.A, a?.["A"], a?.["Horodatage"], a?.["horodatage"]
  ];
  for (const v of candidates) {
    if (!v) continue;
    const d = typeof v === "number" ? new Date(v) : new Date(String(v));
    const t = d.getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Récupère la **dernière** réponse du Sheet pour un email donné. */
export async function getLatestAnswersForEmail(email: string): Promise<any | null> {
  const clean = normalizeEmail(email);
  if (!clean) return null;
  const res = await getAnswersForEmail(clean);
  if (!res) return null;
  if (Array.isArray(res)) {
    if (res.length === 0) return null;
    return res.slice().sort((a, b) => extractTimestampAny(a) - extractTimestampAny(b)).at(-1) ?? res[0];
  }
  return res;
}

/** Construit un profil à partir de la **dernière** ligne Sheet (même mapping que “Mes infos”). */
export async function buildProfileFromEmail(email: string): Promise<Partial<ProfileT> & { email?: string }> {
  const last = await getLatestAnswersForEmail(email);
  if (!last) return { email: normalizeEmail(email) };
  const built = buildProfileFromAnswers(last); // => B->prenom, C->age, G->objectif/goal, etc.
  // Normalisations légères (sécurise les champs pour notre plan builder)
  const p: Partial<ProfileT> & { email?: string } = {
    ...built,
    email: normalizeEmail(built?.email || email),
  };
  return p;
}

/* ========================= API “beton” depuis le Sheet ========================= */
/** Génère un programme directement depuis l’email (Sheet) en reprenant la logique “Mes infos”. */
export async function planProgrammeFromEmail(email: string, opts: PlanOptions = {}): Promise<{ sessions: AiSessionT[]; profile: Partial<ProfileT> }> {
  const profileFromSheet = await buildProfileFromEmail(email);
  const sessions = planProgrammeFromProfile(profileFromSheet as ProfileInput, opts).sessions;
  return { sessions, profile: profileFromSheet };
}

/** Variante: si on a déjà un objet `answers` (p.ex. batch), on évite un 2e call. */
export function planProgrammeFromAnswers(answers: any, opts: PlanOptions = {}): { sessions: AiSessionT[]; profile: Partial<ProfileT> } {
  const built = buildProfileFromAnswers(answers);
  const sessions = planProgrammeFromProfile(built as ProfileInput, opts).sessions;
  return { sessions, profile: built };
}

/* ========================= Public API (historique) ========================= */
export function planProgrammeFromProfile(
  profile: ProfileInput,
  opts: PlanOptions = {}
): { sessions: AiSessionT[] } {
  const today = opts.today ?? new Date();
  const maxSessions = Math.max(1, Math.min(opts.maxSessions ?? 3, 6));

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

  const sessions: AiSessionT[] = [];
  for (let i = 0; i < maxSessions; i++) {
    const d = addDays(today, i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    const variant = i % 3; // A/B/C
    const labelABC = ["A", "B", "C"][variant];

    const title = profile.prenom
      ? `Séances pour ${profile.prenom} — ${labelABC}`
      : defaultTitle(type, i);

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
      type,
      date: dateStr,
      plannedMin: minutes,
      intensity: type === "hiit" ? "élevée" : type === "cardio" ? "modérée" : "modérée",
      exercises: exos,
    } as AiSessionT);
  }

  return { sessions };
}

/* ========================= Contexte & utils ========================= */
type Ctx = {
  level: "debutant" | "intermediaire" | "avance";
  equip: "none" | "limited" | "full";
  minutes: number;
  goalKey: string;
  injuries: Injuries;       // set normalisé
  equipItems: Items;        // set normalisé
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
  bands?: boolean;      // élastiques
  kb?: boolean;         // kettlebell
  trx?: boolean;
  bench?: boolean;
  bar?: boolean;
  db?: boolean;         // haltères
  bike?: boolean;
  rower?: boolean;
  treadmill?: boolean;
};

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

function defaultTitle(t: WorkoutType, i: number) {
  const base = t === "cardio" ? "Cardio" : t === "mobilité" ? "Mobilité" : t === "hiit" ? "HIIT" : "Muscu";
  const abc = ["A", "B", "C"][i % 3];
  return `${base} — ${abc}`;
}

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

/* ========================= Builders par type ========================= */
function buildCardio(ctx: Ctx, variantIdx: number): NormalizedExercise[] {
  const { minutes, equipItems } = ctx;
  const warm = { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" } as NormalizedExercise;
  const cool = { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" } as NormalizedExercise;

  let main: NormalizedExercise;
  if (variantIdx % 2 === 0) {
    const dur = Math.max(15, minutes - 12);
    main = { name: equipItems.bike ? "Vélo Z2 continu" : equipItems.rower ? "Rameur Z2 continu" : "Z2 continu", reps: `${dur} min`, block: "principal" };
  } else {
    main = { name: equipItems.treadmill ? "Fractionné Z2/Z3 sur tapis" : "Fractionné Z2/Z3", reps: "12×(1’/1’)", block: "principal" };
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
  out.push(adjustForInjuries(ctx, { name: "Burpees (option sans saut)", reps: "30–40s", rest: "30–40s", block: "principal", notes: "Retire le saut/impact si genoux sensibles." }));
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
      out.push(adjustForInjuries(ctx, barbell("Soulevé de terre (technique)", ctx, "dos", { notes: "Charge modérée, technique propre." })));
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
  const e = { ...ex };

  // RIR et tempo adaptés selon objectif/niveau
  if (e.sets && !e.rir) e.rir = rirFor(ctx.level);
  if (e.sets && !e.tempo) e.tempo = tempoFor(ctx.goalKey);

  // Contre-indications simples
  // Dos sensible → éviter charges lourdes sur rachis: Back Squat, Deadlift; préférer Goblet, Hip Thrust, Split squat
  if (ctx.injuries.back) {
    if (/back squat|soulevé de terre|deadlift|row à la barre/i.test(e.name)) {
      return swap(e, preferBackFriendly(e, ctx));
    }
    if (/superman/i.test(e.name)) {
      e.notes = joinNotes(e.notes, "Si gêne au dos, réduire l’amplitude ou remplacer par Bird-Dog.");
    }
  }
  // Epaules sensibles → éviter overhead strict, dips profonds; préférer développé incliné/haltères neutres, pompes surélevées
  if (ctx.injuries.shoulder) {
    if (/militaire|overhead|développé militaire|élevations latérales lourdes/i.test(e.name)) {
      return swap(e, { name: "Développé haltères neutre", sets: e.sets ?? 3, reps: repsFor(ctx.goalKey), rest: "75s", block: e.block, equipment: "haltères", notes: "Prise neutre, amplitude confortable." });
    }
    if (/dips/i.test(e.name)) {
      return swap(e, { name: "Pompes surélevées", sets: e.sets ?? 3, reps: pickBodyweight(ctx.goalKey), rest: "60–75s", block: e.block, equipment: "poids du corps" });
    }
  }
  // Genoux sensibles → éviter sauts, flexions très profondes; préférer hip-dominant, fentes courtes
  if (ctx.injuries.knee) {
    if (/sauté|jump|burpee/i.test(e.name)) {
      return swap(e, { name: "Marche rapide / step-ups bas", sets: e.sets ?? 3, reps: "10–12/ côté", rest: "60s", block: e.block, notes: "Hauteur basse, sans douleur." });
    }
    if (/squat(?!.*goblet)|fente/i.test(e.name)) {
      e.notes = joinNotes(e.notes, "Amplitude contrôlée, pas de douleur, option appui/assistance.");
    }
  }
  // Poignets → préférer poignées/pompes neutres
  if (ctx.injuries.wrist && /pompes|push-up/i.test(e.name)) {
    e.notes = joinNotes(e.notes, "Utiliser poignées de pompe ou poings fermés pour garder le poignet neutre.");
  }
  // Hanches → limiter amplitude extrême; privilégier hip thrust, glute bridge
  if (ctx.injuries.hip && /squat|fente/i.test(e.name)) {
    e.notes = joinNotes(e.notes, "Amplitude confortable, focus stabilité hanche.");
  }
  // Chevilles → limiter plyo et dorsiflexion extrême
  if (ctx.injuries.ankle && /sauté|jump/i.test(e.name)) {
    return swap(e, { name: "Marche rapide inclinée", sets: e.sets ?? 3, reps: "2–3 min", rest: "60s", block: e.block });
  }

  // Utilisation des équipements détaillés si dispo
  if (/tirage élastique|row|tirage/i.test(e.name)) {
    if (ctx.equipItems.bands) {
      e.equipment = e.equipment || "élastiques";
    }
  }
  if (/kettlebell|kb/i.test(e.name) && !ctx.equipItems.kb) {
    // si KB proposé mais pas dispo -> swap vers haltère
    return swap(e, { ...e, name: e.name.replace(/kettlebell|KB/i, "haltère"), equipment: "haltères" });
  }
  if (/trx|suspension/i.test(e.name) && !ctx.equipItems.trx) {
    // alternative tirage
    return swap(e, bodyOrBand("Tirage élastique / serviette", ctx, { reps: e.reps || pickBodyweight(ctx.goalKey) }));
  }

  return e;
}

function preferBackFriendly(ex: NormalizedExercise, ctx: Ctx): NormalizedExercise {
  // alternatives “dos-friendly”
  if (/back squat|front squat/i.test(ex.name)) {
    return dumbbell("Goblet Squat", ctx);
  }
  if (/soulevé de terre/i.test(ex.name)) {
    return dumbbell("Hip Thrust (haltère)", ctx);
  }
  if (/row à la barre/i.test(ex.name)) {
    return dumbbell("Rowing unilatéral", ctx, "dos", { reps: "10–12/ côté" });
  }
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
function barbell(name: string, ctx: Ctx, _area?: "bas" | "haut" | "dos", extra?: Partial<NormalizedExercise>): NormalizedExercise {
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
function dumbbell(name: string, ctx: Ctx, _area?: "bas" | "haut" | "dos", extra?: Partial<NormalizedExercise>): NormalizedExercise {
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
function cableOrMachine(name: string, ctx: Ctx, _area?: "bas" | "haut" | "dos", extra?: Partial<NormalizedExercise>): NormalizedExercise {
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
