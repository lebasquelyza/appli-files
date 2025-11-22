// apps/web/app/dashboard/seance/[id]/page.tsx
import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  type AiSession,
  type NormalizedExercise,
  type WorkoutType,
  type Profile,
} from "../../../../lib/coach/ai";
import SeancePageViewClient from "./SeancePageViewClient";



/* ======================== Utils ======================== */
async function getSignedInEmail(): Promise<string> {
  return cookies().get("app_email")?.value || "";
}

/* Supprime lettres variantes “— A”, “- B”, “· C”, “(D)” */
function stripVariantLetter(s?: string) {
  return String(s || "")
    .replace(/\s*[—–-]\s*[A-Z]\b/gi, "")
    .replace(/\s*·\s*[A-Z]\b/gi, "")
    .replace(/\s*\(([A-Z])\)\s*$/gi, "")
    .trim();
}

/* ====== Fallback exercices (respecte l'équipement) ====== */
function genericFallback(
  type: WorkoutType,
  equip: "full" | "none" = "full",
): NormalizedExercise[] {
  if (type === "cardio") {
    return [
      { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
      { name: "Cardio continu Z2", reps: "25–35 min", block: "principal" },
      {
        name: "Retour au calme + mobilité",
        reps: "5–8 min",
        block: "fin",
      },
      {
        name: "Marche progressive Z1→Z2",
        reps: "10–15 min",
        block: "fin",
      },
    ];
  }
  if (type === "mobilité") {
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

  if (equip === "none") {
    // Muscu, SANS matériel (bodyweight only)
    return [
      {
        name: "Squat au poids du corps",
        sets: 3,
        reps: "12–15",
        rest: "60–75s",
        block: "principal",
      },
      {
        name: "Pompes",
        sets: 3,
        reps: "8–15",
        rest: "60–75s",
        block: "principal",
      },
      {
        name: "Fentes alternées",
        sets: 3,
        reps: "10–12/ côté",
        rest: "60–75s",
        block: "principal",
      },
      {
        name: "Planche",
        sets: 2,
        reps: "30–45s",
        rest: "45s",
        block: "fin",
      },
    ];
  }

  // Muscu, AVEC matériel (par défaut)
  return [
    {
      name: "Goblet Squat",
      sets: 3,
      reps: "8–12",
      rest: "75s",
      block: "principal",
    },
    {
      name: "Développé haltères",
      sets: 3,
      reps: "8–12",
      rest: "75s",
      block: "principal",
    },
    {
      name: "Rowing unilatéral",
      sets: 3,
      reps: "10–12/ côté",
      rest: "75s",
      block: "principal",
    },
    {
      name: "Planche",
      sets: 2,
      reps: "30–45s",
      rest: "45s",
      block: "fin",
    },
  ];
}

/** Nettoyage : on ne garde que l’info utile (supprime RIR/tempo) */
function cleanText(s?: string): string {
  if (!s) return "";
  return String(s)
    .replace(
      /(?:^|\s*[·•\-|,;]\s*)RIR\s*\d+(?:\.\d+)?/gi,
      "",
    )
    .replace(/\b[0-4xX]{3,4}\b/g, "")
    .replace(/Tempo\s*:\s*[0-4xX]{3,4}/gi, "")
    .replace(/\s*[·•\-|,;]\s*(?=[·•\-|,;]|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[·•\-|,;]\s*$/g, "")
    .trim();
}

/* ===== Détection du FOCUS ===== */
export type Focus = "upper" | "lower" | "mix" | "full";

function inferFocusFromTitle(title?: string): Focus | null {
  const s = String(title || "").toLowerCase();
  if (/(haut du corps|upper|push|haut\b)/i.test(s)) return "upper";
  if (/(bas du corps|lower|jambes|legs|bas\b)/i.test(s)) return "lower";
  if (/\bfull body\b/i.test(s)) return "full";
  if (/\bmix|total body|complet|full\b/i.test(s)) return "mix";
  return null;
}
function inferFocusFromProfile(profile?: Profile | null): Focus | null {
  const g = String(profile?.goal || "").toLowerCase();
  if (!g) return null;
  if (g === "hypertrophy" || g === "strength") return "mix";
  if (
    g === "fatloss" ||
    g === "endurance" ||
    g === "general" ||
    g === "mobility"
  )
    return "full";
  return null;
}
function focusLabel(focus: Focus): string {
  return focus === "upper"
    ? "Haut du corps"
    : focus === "lower"
    ? "Bas du corps"
    : focus === "full"
    ? "Full body"
    : "Mix";
}

/** Tags zones */
function isLower(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""} ${ex.notes || ""}`.toLowerCase();
  return /(squat|fente|deadlift|soulev[ée] de terre|hip|glute|fess|ischio|quad|quads|quadriceps|hamstring|mollet|calf|leg(?!\s*raise))/i.test(
    t,
  );
}
function isUpper(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""} ${ex.notes || ""}`.toLowerCase();
  return /(d[ée]velopp[ée]|bench|pec|chest|row|tirage|pull(?:-?up)?|traction|dos|back|[ée]paul|shoulder|delts?|biceps?|triceps?|curl|extension triceps)/i.test(
    t,
  );
}
function isCoreOrNeutral(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""} ${ex.notes || ""}`.toLowerCase();
  return /(gainage|planche|plank|abdo|core|hollow|dead bug|oiseau|bird dog|good morning|pont|bridge|mobilit[eé]|respiration)/i.test(
    t,
  );
}
function filterExercisesByFocus(
  exs: NormalizedExercise[],
  focus: Focus,
): NormalizedExercise[] {
  if (focus === "mix" || focus === "full") return exs.slice();
  const out: NormalizedExercise[] = [];
  for (const ex of exs) {
    if (isCoreOrNeutral(ex)) {
      out.push(ex);
      continue;
    }
    if (focus === "upper" && isUpper(ex)) out.push(ex);
    if (focus === "lower" && isLower(ex)) out.push(ex);
  }
  return out.length >= Math.min(3, exs.length) ? out : exs;
}

/* ===== Détection “nécessite matériel” (strict) ===== */
function requiresEquipment(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.notes || ""}`.toLowerCase();
  return /halt[eè]re|dumbbell|barre|barbell|kettlebell|kettle|machine|poulie|c(?:â|a)ble|smith|presse|leg\s*press|bench\b|banc|box jump|box\b|step(?:per)?|[ée]lastique|band|trx|sangle|anneaux|rings?|med(?:ecine)?\s*ball|ballon|bosu|ab\s*wheel|roue\s*abdo|rameur|rower|erg|assault\s*bike|v[ée]lo|tapis|pull-?up|tractions?|dips?|barre\s*fixe|chaise|table/i.test(
    t,
  );
}

/* ===== Helpers backfill (≥ 4 exercices) ===== */
function uniqByName(list: NormalizedExercise[]): NormalizedExercise[] {
  const seen = new Set<string>();
  return list.filter((ex) => {
    const k = (ex.name || "").trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function scoreExerciseForBackfill(ex: NormalizedExercise): number {
  const name = (ex.name || "").toLowerCase();
  let score = 0;
  if ((ex.block || "").toLowerCase() === "principal") score += 3;
  if (
    /(squat|fente|deadlift|soulev[ée] de terre|row|tirage|pull(?:-?up)?|traction|d[ée]velopp[ée]|press|hip|glute)/i.test(
      name,
    )
  )
    score += 2;
  if (ex.sets && ex.reps) score += 1;
  return score;
}
function ensureAtLeast4Exercises(
  filtered: NormalizedExercise[],
  type: WorkoutType,
  focus: Focus,
  original: NormalizedExercise[],
  equip: "full" | "none",
): NormalizedExercise[] {
  const need = Math.max(0, 4 - filtered.length);
  if (need === 0) return uniqByName(filtered);

  const filteredKeys = new Set(
    filtered.map((e) => (e.name || "").trim().toLowerCase()),
  );
  const remainingFromOriginal = original
    .filter(
      (e) => !filteredKeys.has((e.name || "").trim().toLowerCase()),
    )
    .sort((a, b) => scoreExerciseForBackfill(b) - scoreExerciseForBackfill(a));

  const combined: NormalizedExercise[] = [...filtered];

  for (const ex of remainingFromOriginal) {
    if (combined.length >= 4) break;
    if (equip === "none" && requiresEquipment(ex)) continue;
    combined.push(ex);
  }

  if (combined.length < 4) {
    const fallbacks = genericFallback(type, equip);
    for (const ex of fallbacks) {
      if (combined.length >= 4) break;
      if (equip === "none" && requiresEquipment(ex)) continue;
      if (focus === "upper" && !(isUpper(ex) || isCoreOrNeutral(ex))) continue;
      if (focus === "lower" && !(isLower(ex) || isCoreOrNeutral(ex))) continue;
      combined.push(ex);
    }
    if (combined.length < 4) {
      for (const ex of fallbacks) {
        if (combined.length >= 4) break;
        if (equip === "none" && requiresEquipment(ex)) continue;
        combined.push(ex);
      }
    }
  }

  return uniqByName(combined).slice(0, Math.max(4, filtered.length));
}

/* ====================== Chargement (IA + focus + matériel) ====================== */
async function loadData(
  id: string,
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<{
  base: AiSession;
  exercises: NormalizedExercise[];
  focus: Focus;
  plannedMin: number;
}> {
  // Par défaut = avec matériel
  const equipParam: "full" | "none" =
    String(searchParams?.equip || "full").toLowerCase() === "none"
      ? "none"
      : "full";
  const qpTitle =
    typeof searchParams?.title === "string" ? searchParams!.title : "";

  // 1) Lire réponses du Sheet
  const email = await getSignedInEmail();
  let answers: Record<string, any> | null = null;
  let profile: Profile | null = null;

  if (email) {
    answers = await getAnswersForEmail(email);
    if (answers) profile = buildProfileFromAnswers(answers) as Profile;
  }

  // 2) Générer programme depuis réponses
  let base: AiSession | undefined;
  let exercises: NormalizedExercise[] = [];

  if (answers) {
    if (equipParam === "none") (answers as any).equipLevel = "none";
    if (equipParam === "full") (answers as any).equipLevel = "full";

    const regenProg = await generateProgrammeFromAnswers(answers);
    const regen = regenProg.sessions || [];
    // ou équivalent :
    /*
    const { sessions: regen = [] } = await generateProgrammeFromAnswers(answers);
    */

    // Match par title d'abord, sinon par id
    base =
      (qpTitle &&
        regen.find(
          (s) =>
            stripVariantLetter(s.title) ===
            stripVariantLetter(qpTitle),
        )) ||
      undefined;
    if (!base) base = regen.find((s) => s.id === id);
    if (!base) base = regen[0];

    if (base?.exercises?.length) exercises = base.exercises!;
  }

  // 3) Filets
  if (!base) {
    base = {
      id,
      title: "Séance personnalisée",
      date: "",
      type: "muscu",
      plannedMin: 45,
    } as AiSession;
  }
  if (!exercises.length) {
    exercises = genericFallback(
      (base?.type ?? "muscu") as WorkoutType,
      equipParam,
    );
  }

  // 4) Déduire le focus puis filtrer
  const focus =
    inferFocusFromTitle(qpTitle || base.title) ||
    inferFocusFromProfile(profile) ||
    "mix";

  let filtered = filterExercisesByFocus(exercises, focus);

  // 5) Si equip=none → strict bodyweight
  if (equipParam === "none") {
    filtered = filtered.filter((ex) => !requiresEquipment(ex));
  }

  // 6) Filet ≥ 4
  const ensured = ensureAtLeast4Exercises(
    filtered,
    (base?.type ?? "muscu") as WorkoutType,
    focus,
    exercises,
    equipParam,
  );

  const plannedMin = base.plannedMin ?? 45;
  const finalBase = {
    ...base,
    title: stripVariantLetter(qpTitle || base.title),
  };

  return { base: finalBase, exercises: ensured, focus, plannedMin };
}

/* ======================== Page (server) ======================== */
export default async function Page({
  params,
  searchParams,
}: {
  params: { id?: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = decodeURIComponent(params?.id ?? "");
  if (!id && !(searchParams?.title || searchParams?.type)) {
    redirect("/dashboard/profile?error=Seance%20introuvable");
  }

  const { base, exercises, focus, plannedMin } = await loadData(
    id,
    searchParams,
  );
  if (!base) redirect("/dashboard/profile?error=Seance%20introuvable");

  // Helper pour gérer string | string[]
  const getParam = (name: string) => {
    const v = searchParams?.[name];
    return Array.isArray(v) ? v[0] : v;
  };

  const equip =
    String(getParam("equip") || "").toLowerCase() === "none"
      ? "none"
      : "full";

  const qs = new URLSearchParams();

  // On force generate=1 pour que le programme soit réaffiché au retour
  qs.set("generate", "1");

  // On garde le mode sans matériel si besoin
  if (equip === "none") {
    qs.set("equip", "none");
  }

  // Si tu utilises saved / later pour les listes, on les propage aussi
  const saved = getParam("saved");
  const later = getParam("later");
  if (saved) qs.set("saved", saved);
  if (later) qs.set("later", later);

  const backHref = `/dashboard/profile${qs.toString() ? `?${qs.toString()}` : ""}`;

  return (
    <SeancePageViewClient
      base={base}
      exercises={exercises}
      focus={focus}
      plannedMin={plannedMin}
      backHref={backHref}
    />
  );
}
