// apps/web/app/dashboard/seance/[id]/SeancePageViewClient.tsx
"use client";

import React from "react";
import type { AiSession, NormalizedExercise } from "../../../../lib/coach/ai";
import type { Focus } from "./page"; // type uniquement, pas de logique
import { useLanguage } from "@/components/LanguageProvider";

type Props = {
  base: AiSession;
  exercises: NormalizedExercise[];
  focus: Focus;
  plannedMin: number;
  backHref: string;
};

/** Copie de stripVariantLetter (pure, pas de logique métier) */
function stripVariantLetterLocal(s?: string) {
  return String(s || "")
    .replace(/\s*[—–-]\s*[A-Z]\b/gi, "")
    .replace(/\s*·\s*[A-Z]\b/gi, "")
    .replace(/\s*\(([A-Z])\)\s*$/gi, "")
    .trim();
}

/** Copie de cleanText pour le rendu des chips */
function cleanTextLocal(s?: string): string {
  if (!s) return "";
  return String(s)
    .replace(/(?:^|\s*[·•\-|,;]\s*)RIR\s*\d+(?:\.\d+)?/gi, "")
    .replace(/\b[0-4xX]{3,4}\b/g, "")
    .replace(/Tempo\s*:\s*[0-4xX]{3,4}/gi, "")
    .replace(/\s*[·•\-|,;]\s*(?=[·•\-|,;]|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[·•\-|,;]\s*$/g, "")
    .trim();
}

function focusLabelT(focus: Focus, t: (path: string) => string): string {
  switch (focus) {
    case "upper":
      return t("seancePage.focus.upper");
    case "lower":
      return t("seancePage.focus.lower");
    case "full":
      return t("seancePage.focus.full");
    case "mix":
    default:
      return t("seancePage.focus.mix");
  }
}

/** 🔤 Dictionnaire FR -> EN pour les noms d'exos générés côté "béton" + fallbacks */
const EXERCISE_NAME_I18N: Record<
  string,
  { fr: string; en: string }
> = {
  // -------- Cardio / mobilité / HIIT --------
  "Échauffement Z1": { fr: "Échauffement Z1", en: "Z1 warm-up" },
  "Cardio continu Z2": {
    fr: "Cardio continu Z2",
    en: "Z2 steady-state cardio",
  },
  "Retour au calme + mobilité": {
    fr: "Retour au calme + mobilité",
    en: "Cool-down + mobility",
  },
  "Marche progressive Z1→Z2": {
    fr: "Marche progressive Z1→Z2",
    en: "Progressive walk Z1→Z2",
  },
  "Vélo Z2 continu": {
    fr: "Vélo Z2 continu",
    en: "Bike Z2 steady-state",
  },
  "Rameur Z2 continu": {
    fr: "Rameur Z2 continu",
    en: "Rower Z2 steady-state",
  },
  "Z2 continu": { fr: "Z2 continu", en: "Z2 steady-state" },
  "Fractionné Z2/Z3 sur tapis": {
    fr: "Fractionné Z2/Z3 sur tapis",
    en: "Z2/Z3 intervals on treadmill",
  },
  "Fractionné Z2/Z3": {
    fr: "Fractionné Z2/Z3",
    en: "Z2/Z3 intervals",
  },
  "Respiration diaphragmatique": {
    fr: "Respiration diaphragmatique",
    en: "Diaphragmatic breathing",
  },
  "90/90 hanches": { fr: "90/90 hanches", en: "90/90 hips" },
  "T-spine rotations": {
    fr: "T-spine rotations",
    en: "T-spine rotations",
  },
  "Down-Dog → Cobra": {
    fr: "Down-Dog → Cobra",
    en: "Down-Dog → Cobra",
  },
  "Air Squats": { fr: "Air Squats", en: "Air squats" },
  "Mountain Climbers": {
    fr: "Mountain Climbers",
    en: "Mountain climbers",
  },
  "Burpees (option sans saut)": {
    fr: "Burpees (option sans saut)",
    en: "Burpees (no-jump option)",
  },

  // -------- Fallback muscu sans matériel --------
  "Squat au poids du corps": {
    fr: "Squat au poids du corps",
    en: "Bodyweight squat",
  },
  Pompes: { fr: "Pompes", en: "Push-ups" },
  "Fentes alternées": {
    fr: "Fentes alternées",
    en: "Alternating lunges",
  },
  Planche: { fr: "Planche", en: "Plank" },

  // -------- Fallback muscu avec matériel --------
  "Goblet Squat": { fr: "Goblet Squat", en: "Goblet squat" },
  "Développé haltères": {
    fr: "Développé haltères",
    en: "Dumbbell press",
  },
  "Rowing unilatéral": {
    fr: "Rowing unilatéral",
    en: "One-arm row",
  },

  // -------- Pools muscu / bas du corps --------
  "Tirage vertical": {
    fr: "Tirage vertical",
    en: "Vertical pull",
  },
  "Tirage élastique": {
    fr: "Tirage élastique",
    en: "Band row",
  },
  "Élévations latérales": {
    fr: "Élévations latérales",
    en: "Lateral raises",
  },
  "Curl biceps (élastique/haltères)": {
    fr: "Curl biceps (élastique/haltères)",
    en: "Biceps curl (band/dumbbells)",
  },
  "Front Squat": { fr: "Front Squat", en: "Front squat" },
  "Presse à cuisses": {
    fr: "Presse à cuisses",
    en: "Leg press",
  },
  "Fente arrière": {
    fr: "Fente arrière",
    en: "Reverse lunge",
  },
  "Leg Extension (élastique/machine)": {
    fr: "Leg Extension (élastique/machine)",
    en: "Leg extension (band/machine)",
  },
  "Hip Thrust (barre/haltère)": {
    fr: "Hip Thrust (barre/haltère)",
    en: "Hip thrust (bar/dumbbell)",
  },
  "Hip Thrust au sol": {
    fr: "Hip Thrust au sol",
    en: "Floor hip thrust",
  },
  "Soulevé de terre roumain": {
    fr: "Soulevé de terre roumain",
    en: "Romanian deadlift",
  },
  "RDL haltères": {
    fr: "RDL haltères",
    en: "Dumbbell Romanian deadlift",
  },
  "Good Morning haltères": {
    fr: "Good Morning haltères",
    en: "Dumbbell good morning",
  },
  "Pont fessier": {
    fr: "Pont fessier",
    en: "Glute bridge",
  },
  "Leg Curl (élastique)": {
    fr: "Leg Curl (élastique)",
    en: "Leg curl (band)",
  },
  "Nordic curl assisté": {
    fr: "Nordic curl assisté",
    en: "Assisted Nordic curl",
  },
  "Abduction hanches (élastique)": {
    fr: "Abduction hanches (élastique)",
    en: "Hip abduction (band)",
  },

  // -------- Pools muscu / haut du corps --------
  "Bench Press": { fr: "Bench Press", en: "Bench press" },
  "Développé haltères incliné": {
    fr: "Développé haltères incliné",
    en: "Incline dumbbell press",
  },
  "Triceps extension (poulie/élastique)": {
    fr: "Triceps extension (poulie/élastique)",
    en: "Triceps extension (cable/band)",
  },
  "Extension triceps haltères": {
    fr: "Extension triceps haltères",
    en: "Dumbbell triceps extension",
  },
  "Écartés (haltères/élastique)": {
    fr: "Écartés (haltères/élastique)",
    en: "Chest fly (dumbbell/band)",
  },
  "Tractions / Tirage vertical": {
    fr: "Tractions / Tirage vertical",
    en: "Pull-ups / Lat pulldown",
  },
  "Rowing buste penché": {
    fr: "Rowing buste penché",
    en: "Bent-over row",
  },
  "Row avec serviette/table": {
    fr: "Row avec serviette/table",
    en: "Inverted row with towel/table",
  },
  "Face Pull (câble/élastique)": {
    fr: "Face Pull (câble/élastique)",
    en: "Face pull (cable/band)",
  },
  "Tirage horizontal élastique": {
    fr: "Tirage horizontal élastique",
    en: "Horizontal row (band)",
  },
  "Curl incliné (haltères)": {
    fr: "Curl incliné (haltères)",
    en: "Incline dumbbell curl",
  },
  "Extension triceps (poulie/élastique)": {
    fr: "Extension triceps (poulie/élastique)",
    en: "Triceps extension (cable/band)",
  },

  // -------- Warm-up / core / divers --------
  "Activation hanches/chevilles": {
    fr: "Activation hanches/chevilles",
    en: "Hips/ankles activation",
  },
  "Activation épaules/omoplates": {
    fr: "Activation épaules/omoplates",
    en: "Shoulders/scapula activation",
  },
  "Gainage planche": {
    fr: "Gainage planche",
    en: "Plank hold",
  },
  "Side Plank (gauche/droite)": {
    fr: "Side Plank (gauche/droite)",
    en: "Side plank (left/right)",
  },

  // -------- Ajustements blessures --------
  "Développé haltères neutre": {
    fr: "Développé haltères neutre",
    en: "Neutral-grip dumbbell press",
  },
  "Pompes surélevées": {
    fr: "Pompes surélevées",
    en: "Elevated push-ups",
  },
  "Marche rapide / step-ups bas": {
    fr: "Marche rapide / step-ups bas",
    en: "Brisk walk / low step-ups",
  },
  "Marche rapide inclinée": {
    fr: "Marche rapide inclinée",
    en: "Incline brisk walk",
  },
  "Tirage élastique / serviette": {
    fr: "Tirage élastique / serviette",
    en: "Band/towel row",
  },
};

/** Traduit un nom d'exercice FR -> EN si possible, sinon renvoie le nom brut */
function translateExerciseName(
  raw: string,
  lang: "fr" | "en"
): string {
  if (!raw) return raw;
  if (lang === "fr") return raw;
  const key = raw.trim();
  const entry = EXERCISE_NAME_I18N[key];
  if (!entry) return raw; // fallback : nom original
  return entry.en;
}

function Chip({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  if (!value) return null;
  return (
    <span
      title={title || label}
      className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] leading-[14px] text-neutral-800"
    >
      <span className="mr-1 opacity-70">{label}</span> {value}
    </span>
  );
}

const SeancePageViewClient: React.FC<Props> = ({
  base,
  exercises,
  focus,
  plannedMin,
  backHref,
}) => {
  const { t, lang } = useLanguage();

  const displayTitle =
    stripVariantLetterLocal(base.title) || focusLabelT(focus, t);

  return (
    <div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
  .compact-card { padding: 12px; border-radius: 16px; background:#fff; box-shadow: 0 1px 0 rgba(17,24,39,.05); border:1px solid #e5e7eb; }
  .h1-compact { margin-bottom:2px; font-size: clamp(20px, 2.2vw, 24px); line-height:1.15; font-weight:800; }
  .lead-compact { margin-top:4px; font-size: clamp(12px, 1.6vw, 14px); line-height:1.35; color:#4b5563; }
  .exoname { font-size: 15.5px; line-height:1.25; font-weight:700; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .btn-ghost { background:#fff; color:#111827; border:1px solid #e5e7eb; border-radius:8px; padding:6px 10px; font-weight:600; }
          `,
        }}
      />

      <div
        className="mb-2 flex items-center justify-between no-print"
        style={{ paddingInline: 12 }}
      >
        <a href={backHref} className="btn-ghost">
          {t("seancePage.backButton")}
        </a>
        <div className="text-xs text-gray-400">
          {t("seancePage.aiBadge")}
        </div>
      </div>

      <div
        className="mx-auto w-full"
        style={{ maxWidth: 640, paddingInline: 12, paddingBottom: 24 }}
      >
        <div className="page-header">
          <div>
            <h1 className="h1-compact">{displayTitle}</h1>
            <p className="lead-compact">
              {plannedMin} {t("seancePage.plannedMinSuffix")} · {base.type}
            </p>
          </div>
        </div>

        <section className="section" style={{ marginTop: 12 }}>
          <div className="grid gap-3">
            {exercises.map((ex, i) => {
              const reps = cleanTextLocal(
                ex.reps
                  ? String(ex.reps)
                  : ex.durationSec
                  ? `${ex.durationSec}s`
                  : ""
              );
              const rest = cleanTextLocal(ex.rest || "");
              const translatedName = translateExerciseName(
                ex.name,
                lang
              );

              return (
                <article key={i} className="compact-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="exoname">{translatedName}</div>
                  </div>
                  <div className="chips">
                    {typeof ex.sets === "number" && (
                      <Chip
                        label="🧱"
                        value={`${ex.sets} ${t(
                          "seancePage.chips.setsLabel"
                        )}`}
                        title={t("seancePage.chips.setsLabel")}
                      />
                    )}
                    {reps && (
                      <Chip
                        label="🔁"
                        value={reps}
                        title={t("seancePage.chips.repsLabel")}
                      />
                    )}
                    {rest && (
                      <Chip
                        label="⏲️"
                        value={rest}
                        title={t("seancePage.chips.restLabel")}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SeancePageViewClient;
