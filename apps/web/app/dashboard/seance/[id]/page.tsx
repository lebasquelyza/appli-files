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

/* ====== Fallback exercices si jamais rien ne remonte ====== */
function genericFallback(type: WorkoutType): NormalizedExercise[] {
  if (type === "cardio")
    return [
      { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
      { name: "Cardio continu Z2", reps: "25–35 min", block: "principal" },
      { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" },
      { name: "Marche progressive Z1→Z2", reps: "10–15 min", block: "fin" },
    ];
  if (type === "mobilité")
    return [
      { name: "Respiration diaphragmatique", reps: "2–3 min", block: "echauffement" },
      { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
      { name: "T-spine rotations", reps: "8–10/ côté", block: "principal" },
      { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
    ];
  return [
    { name: "Goblet Squat", sets: 3, reps: "8–12", rest: "75s", block: "principal" },
    { name: "Développé haltères", sets: 3, reps: "8–12", rest: "75s", block: "principal" },
    { name: "Rowing unilatéral", sets: 3, reps: "10–12/ côté", rest: "75s", block: "principal" },
    { name: "Planche", sets: 2, reps: "30–45s", rest: "45s", block: "fin" },
  ];
}

/** Nettoyage : on ne garde que l’info utile (supprime RIR/tempo) */
function cleanText(s?: string): string {
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

/* ===== Détection du FOCUS ===== */
type Focus = "upper" | "lower" | "mix" | "full";

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
  if (g === "fatloss" || g === "endurance" || g === "general" || g === "mobility") return "full";
  return null;
}
function focusLabel(focus: Focus): string {
  return focus === "upper" ? "Haut du corps" :
         focus === "lower" ? "Bas du corps" :
         focus === "full"  ? "Full body" :
                              "Mix";
}

/** Tag zone grossier */
function isLower(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""} ${ex.notes || ""}`.toLowerCase();
  return /(squat|fente|deadlift|soulev[ée] de terre|hip|glute|fess|ischio|quad|quads|quadriceps|hamstring|mollet|calf|leg(?!\s*raise))/i.test(t);
}
function isUpper(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""} ${ex.notes || ""}`.toLowerCase();
  return /(d[ée]velopp[ée]|bench|pec|chest|row|tirage|pull(?:-?up)?|traction|dos|back|[ée]paul|shoulder|delts?|biceps?|triceps?|curl|extension triceps)/i.test(t);
}
function isCoreOrNeutral(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""} ${ex.notes || ""}`.toLowerCase();
  return /(gainage|planche|plank|abdo|core|hollow|dead bug|oiseau|bird dog|good morning|pont|bridge|mobilit[eé]|respiration)/i.test(t);
}
function filterExercisesByFocus(exs: NormalizedExercise[], focus: Focus): NormalizedExercise[] {
  if (focus === "mix" || focus === "full") return exs.slice();
  const out: NormalizedExercise[] = [];
  for (const ex of exs) {
    if (isCoreOrNeutral(ex)) { out.push(ex); continue; }
    if (focus === "upper" && isUpper(ex)) out.push(ex);
    if (focus === "lower" && isLower(ex)) out.push(ex);
  }
  return out.length >= Math.min(3, exs.length) ? out : exs;
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

/** Priorise des exos "coach" pour le backfill : bloc principal, polyarticulaires, puis le reste */
function scoreExerciseForBackfill(ex: NormalizedExercise): number {
  const name = (ex.name || "").toLowerCase();
  let score = 0;
  if ((ex.block || "").toLowerCase() === "principal") score += 3;
  if (/(squat|fente|deadlift|soulev[ée] de terre|row|tirage|pull(?:-?up)?|traction|d[ée]velopp[ée]|press|hip|glute)/i.test(name)) score += 2;
  if (ex.sets && ex.reps) score += 1;
  return score;
}

/**
 * Complète la liste filtrée pour garantir >= 4 exercices,
 * sans casser l’ordre initial : on garde d’abord `filtered`,
 * puis on pioche dans `original` (non inclus), puis le fallback générique.
 */
function ensureAtLeast4Exercises(
  filtered: NormalizedExercise[],
  type: WorkoutType,
  focus: Focus,
  original: NormalizedExercise[]
): NormalizedExercise[] {
  const need = Math.max(0, 4 - filtered.length);
  if (need === 0) return uniqByName(filtered);

  const filteredKeys = new Set(filtered.map((e) => (e.name || "").trim().toLowerCase()));
  const remainingFromOriginal = original
    .filter((e) => !filteredKeys.has((e.name || "").trim().toLowerCase()))
    .sort((a, b) => scoreExerciseForBackfill(b) - scoreExerciseForBackfill(a));

  const combined: NormalizedExercise[] = [...filtered];

  for (const ex of remainingFromOriginal) {
    if (combined.length >= 4) break;
    combined.push(ex);
  }

  if (combined.length < 4) {
    const fallbacks = genericFallback(type);
    for (const ex of fallbacks) {
      if (combined.length >= 4) break;
      if (focus === "upper" && !(isUpper(ex) || isCoreOrNeutral(ex))) continue;
      if (focus === "lower" && !(isLower(ex) || isCoreOrNeutral(ex))) continue;
      combined.push(ex);
    }
    if (combined.length < 4) {
      for (const ex of fallbacks) {
        if (combined.length >= 4) break;
        combined.push(ex);
      }
    }
  }

  return uniqByName(combined).slice(0, Math.max(4, filtered.length));
}

/* ====================== Chargement (IA + filtre focus) ====================== */
async function loadData(
  id: string,
  searchParams?: Record<string, string | string[] | undefined>
): Promise<{
  base: AiSession;
  exercises: NormalizedExercise[];
  focus: Focus;
  plannedMin: number;
}> {
  const equipParam = String(searchParams?.equip || "").toLowerCase();
  const qpTitle = typeof searchParams?.title === "string" ? searchParams!.title : "";

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

    const regenProg = generateProgrammeFromAnswers(answers); // IA
    const regen = regenProg.sessions || [];

    // Match par title d'abord (on passe le title depuis la liste), sinon par id
    base = (qpTitle && regen.find((s) => stripVariantLetter(s.title) === stripVariantLetter(qpTitle))) || undefined;
    if (!base) base = regen.find((s) => s.id === id);
    if (!base) base = regen[0];

    if (base?.exercises?.length) exercises = base.exercises!;
  }

  // 3) Filets
  if (!base) {
    base = { id, title: "Séance personnalisée", date: "", type: "muscu", plannedMin: 45 } as AiSession;
  }
  if (!exercises.length) {
    exercises = genericFallback((base?.type ?? "muscu") as WorkoutType);
  }

  // 4) Déduire le focus, puis filtrer
  const focus =
    inferFocusFromTitle(qpTitle || base.title) ||
    inferFocusFromProfile(profile) ||
    "mix";

  const filtered = filterExercisesByFocus(exercises, focus);
  const ensured = ensureAtLeast4Exercises(filtered, (base?.type ?? "muscu") as WorkoutType, focus, exercises);
  const plannedMin = base.plannedMin ?? 45;

  // titre sans lettres
  const finalBase = { ...base, title: stripVariantLetter(qpTitle || base.title) };

  return { base: finalBase, exercises: ensured, focus, plannedMin };
}

/* ======================== UI helpers ======================== */
function Chip({ label, value, title }: { label: string; value: string; title?: string }) {
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

/* ======================== View ======================== */
const PageView: React.FC<{
  base: AiSession;
  exercises: NormalizedExercise[];
  focus: Focus;
  plannedMin: number;
}> = ({ base, exercises, focus, plannedMin }) => {
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

      <div className="mb-2 flex items-center justify-between no-print" style={{ paddingInline: 12 }}>
        <a href="/dashboard/profile" className="btn-ghost">← Retour</a>
        <div className="text-xs text-gray-400">Programme IA</div>
      </div>

      <div className="mx-auto w-full" style={{ maxWidth: 640, paddingInline: 12, paddingBottom: 24 }}>
        <div className="page-header">
          <div>
            <h1 className="h1-compact">{stripVariantLetter(base.title) || focusLabel(focus)}</h1>
            <p className="lead-compact">{plannedMin} min · {base.type}</p>
          </div>
        </div>

        <section className="section" style={{ marginTop: 12 }}>
          <div className="grid gap-3">
            {exercises.map((ex, i) => {
              const reps = cleanText(ex.reps ? String(ex.reps) : ex.durationSec ? `${ex.durationSec}s` : "");
              const rest = cleanText(ex.rest || "");
              return (
                <article key={i} className="compact-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="exoname">{ex.name}</div>
                  </div>
                  <div className="chips">
                    {typeof ex.sets === "number" && <Chip label="🧱" value={`${ex.sets} séries`} title="Séries" />}
                    {reps && <Chip label="🔁" value={reps} title="Rép./Durée" />}
                    {rest && <Chip label="⏲️" value={rest} title="Repos" />}
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

  const { base, exercises, focus, plannedMin } = await loadData(id, searchParams);
  if (!base) redirect("/dashboard/profile?error=Seance%20introuvable");

  return <PageView base={base} exercises={exercises} focus={focus} plannedMin={plannedMin} />;
}
