// apps/web/lib/exerciseI18n.ts

// Lang vient de ton LanguageProvider : "fr" | "en"
export type Lang = "fr" | "en";

/**
 * Normalise un nom pour matcher même si accents / majuscules changent.
 */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Petit dictionnaire FR → EN pour les exos générés par béton.
 * (On peut l’agrandir au fur et à mesure.)
 */
const EXERCISE_MAP_EN: { match: (norm: string) => boolean; en: string }[] = [
  // =========================
  // Échauffement / mobilité / cardio
  // =========================
  {
    match: (n) => n.startsWith("echauffement z1"),
    en: "Warm-up Z1",
  },
  {
    match: (n) => n.startsWith("retour au calme"),
    en: "Cool-down + mobility",
  },
  {
    match: (n) => n.startsWith("respiration diaphragmat"),
    en: "Diaphragmatic breathing",
  },
  {
    match: (n) => n.startsWith("respiration + flow leger") || n.startsWith("respiration + flow léger"),
    en: "Breathing + light flow",
  },
  {
    match: (n) => n.startsWith("90/90 hanches"),
    en: "90/90 hip rotations",
  },
  {
    match: (n) => n.startsWith("t-spine rotations"),
    en: "T-spine rotations",
  },
  {
    match: (n) => n.startsWith("down-dog") || n.startsWith("down dog"),
    en: "Down-Dog → Cobra",
  },
  {
    match: (n) => n.startsWith("etirements complets") || n.startsWith("étirements complets"),
    en: "Full-body stretches",
  },
  {
    match: (n) => n.startsWith("marche progressive z1"),
    en: "Progressive walk Z1→Z2",
  },
  {
    match: (n) => n.startsWith("marche rapide / step-ups bas"),
    en: "Brisk walk / low step-ups",
  },
  {
    match: (n) => n.startsWith("marche rapide inclinee") || n.startsWith("marche rapide inclinée"),
    en: "Incline brisk walk",
  },

  // =========================
  // Activation
  // =========================
  {
    match: (n) => n.startsWith("activation hanches/chevilles"),
    en: "Hips/ankles activation",
  },
  {
    match: (n) =>
      n.startsWith("activation epaules/omoplates") ||
      n.startsWith("activation épaules/omoplates"),
    en: "Shoulders/scapula activation",
  },
  {
    match: (n) => n.startsWith("activation hanches/fessiers"),
    en: "Hips/glutes activation",
  },

  // =========================
  // Bas du corps
  // =========================
  {
    match: (n) => n.startsWith("goblet squat"),
    en: "Goblet squat",
  },
  {
    match: (n) => n.startsWith("front squat"),
    en: "Front squat",
  },
  {
    match: (n) => n.startsWith("presse a cuisses") || n.startsWith("presse à cuisses"),
    en: "Leg press",
  },
  {
    match: (n) => n.startsWith("fente arriere") || n.startsWith("fente arrière"),
    en: "Reverse lunge",
  },
  {
    match: (n) => n.startsWith("fentes laterales") || n.startsWith("fentes latérales"),
    en: "Lateral lunges",
  },
  {
    match: (n) => n.startsWith("leg extension"),
    en: "Leg extension (band/machine)",
  },
  {
    match: (n) => n.startsWith("squat partiel"),
    en: "Partial squat",
  },
  {
    match: (n) =>
      n.startsWith("hip thrust (barre/halteres") ||
      n.startsWith("hip thrust (barre/halt") ||
      n.startsWith("hip thrust (barre"),
    en: "Hip thrust (barbell/dumbbell)",
  },
  {
    match: (n) => n.startsWith("hip thrust au sol"),
    en: "Hip thrust on the floor",
  },
  {
    match: (n) =>
      n.startsWith("souleve de terre roumain") ||
      n.startsWith("soulevé de terre roumain"),
    en: "Romanian deadlift",
  },
  {
    match: (n) => n.startsWith("rdl halteres") || n.startsWith("rdl haltères"),
    en: "Dumbbell RDL",
  },
  {
    match: (n) => n.startsWith("good morning halteres") || n.startsWith("good morning haltères"),
    en: "Dumbbell good-morning",
  },
  {
    match: (n) => n.startsWith("pont fessier") || n === "glute bridge",
    en: "Glute bridge",
  },
  {
    match: (n) => n.startsWith("leg curl"),
    en: "Leg curl (band)",
  },
  {
    match: (n) => n.startsWith("nordic curl assiste") || n.startsWith("nordic curl assisté"),
    en: "Assisted Nordic curl",
  },
  {
    match: (n) => n.startsWith("abduction hanches"),
    en: "Hip abduction (band)",
  },

  // =========================
  // Mollets / avant-bras / grip
  // =========================
  {
    match: (n) => n.startsWith("mollets debout"),
    en: "Standing calf raises",
  },
  {
    match: (n) => n.startsWith("curl poignets"),
    en: "Wrist curl (forearms)",
  },
  {
    match: (n) => n.startsWith("farmer carry"),
    en: "Farmer carry (loaded/bodyweight)",
  },

  // =========================
  // Haut du corps (push)
  // =========================
  {
    match: (n) => n === "bench press",
    en: "Bench press",
  },
  {
    match: (n) =>
      n.startsWith("developpe halteres incline") ||
      n.startsWith("developpe haltères incline") ||
      n.startsWith("développé haltères incliné"),
    en: "Incline dumbbell press",
  },
  {
    match: (n) =>
      n.startsWith("developpe militaire halteres") ||
      n.startsWith("developpe militaire haltères") ||
      n.startsWith("développé militaire haltères"),
    en: "Dumbbell military press",
  },
  {
    match: (n) =>
      n.startsWith("developpe halteres neutre") ||
      n.startsWith("développé haltères neutre"),
    en: "Neutral-grip dumbbell press",
  },
  {
    match: (n) =>
      n.startsWith("developpe halteres") ||
      n.startsWith("developpe haltères") ||
      n.startsWith("développé haltères"),
    en: "Dumbbell press",
  },
  {
    match: (n) => n.startsWith("pompes surelevees") || n.startsWith("pompes surélevées"),
    en: "Elevated push-ups",
  },
  {
    match: (n) => n === "pompes",
    en: "Push-ups",
  },
  {
    match: (n) =>
      n.startsWith("elevations laterales") ||
      n.startsWith("élévations latérales"),
    en: "Lateral raises",
  },
  {
    match: (n) => n.startsWith("triceps extension"),
    en: "Triceps extension (cable/band)",
  },
  {
    match: (n) => n.startsWith("extension triceps"),
    en: "Dumbbell triceps extension",
  },
  {
    match: (n) => n.startsWith("ecartes") || n.startsWith("écartés"),
    en: "Chest fly (dumbbells/band)",
  },

  // =========================
  // Haut du corps (pull / dos / biceps)
  // =========================
  {
    match: (n) => n.startsWith("tirage vertical"),
    en: "Vertical pull",
  },
  {
    match: (n) => n.startsWith("tractions / tirage vertical"),
    en: "Pull-ups / vertical pull",
  },
  {
    match: (n) => n.startsWith("tirage elastique / serviette") || n.startsWith("tirage élastique / serviette"),
    en: "Band/towel row",
  },
  {
    match: (n) => n.startsWith("tirage elastique") || n.startsWith("tirage élastique"),
    en: "Band row / pull",
  },
  {
    match: (n) => n.startsWith("tirage horizontal elastique") ||
      n.startsWith("tirage horizontal élastique"),
    en: "Horizontal band row",
  },
  {
    match: (n) => n.startsWith("rowing unilateral") || n.startsWith("rowing unilat"),
    en: "One-arm row",
  },
  {
    match: (n) => n.startsWith("rowing buste penche") || n.startsWith("rowing buste penché"),
    en: "Bent-over row",
  },
  {
    match: (n) => n.startsWith("row avec serviette"),
    en: "Towel row (table)",
  },
  {
    match: (n) => n.startsWith("face pull (elastique") || n.startsWith("face pull (élastique"),
    en: "Face pull (band)",
  },
  {
    match: (n) => n.startsWith("face pull"),
    en: "Face pull",
  },
  {
    match: (n) => n.startsWith("curl biceps"),
    en: "Biceps curl (band/dumbbells)",
  },
  {
    match: (n) => n.startsWith("curl incline"),
    en: "Incline dumbbell curl",
  },

  // =========================
  // Core / gainage / abdos
  // =========================
  {
    match: (n) => n.startsWith("hollow hold"),
    en: "Hollow hold",
  },
  {
    match: (n) => n.startsWith("side plank"),
    en: "Side plank (left/right)",
  },
  {
    match: (n) => n.startsWith("gainage planche"),
    en: "Plank hold",
  },
  {
    match: (n) => n.startsWith("crunchs + gainage"),
    en: "Crunches + plank",
  },

  // =========================
  // HIIT / poids du corps
  // =========================
  {
    match: (n) => n.startsWith("air squats"),
    en: "Air squats",
  },
  {
    match: (n) => n.startsWith("mountain climbers"),
    en: "Mountain climbers",
  },
  {
    match: (n) => n.startsWith("burpees"),
    en: "Burpees (low-impact option)",
  },

  // =========================
  // Divers / mobilité (preset)
  // =========================
  {
    match: (n) => n === "cat-cow" || n === "cat cow",
    en: "Cat-Cow",
  },
  {
    match: (n) => n === "bird-dog" || n === "bird dog",
    en: "Bird-dog",
  },
  {
    match: (n) => n === "plank",
    en: "Plank",
  },
  {
    match: (n) => n === "glute bridge",
    en: "Glute bridge",
  },
  {
    match: (n) => n.startsWith("oiseau au poids du corps"),
    en: "Bent-over rear-delt raises (bodyweight)",
  },
];

/**
 * Traduit un nom d'exercice selon la langue.
 * - FR → on renvoie tel quel
 * - EN → on essaie de mapper vers un nom anglais lisible
 * - Si pas trouvé → on renvoie le nom d'origine
 */
export function translateExerciseName(name: string, lang: Lang): string {
  if (!name) return "";
  if (lang === "fr") return name;

  const norm = normalizeName(name);

  // Si le nom est déjà en anglais (Goblet squat, Hip thrust, Bench press, etc.)
  // on le laisse tel quel.
  if (
    /[a-z]/i.test(name) &&
    !/[éèàùç]/i.test(name) &&
    /\b(squat|press|pull|curl|row|raise|thrust|hold|plank|bridge|walk|carry|hip|calf|glute)\b/i.test(
      name,
    )
  ) {
    return name;
  }

  const hit = EXERCISE_MAP_EN.find((entry) => entry.match(norm));
  return hit ? hit.en : name;
}
