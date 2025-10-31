// apps/web/app/dashboard/seance/[id]/page.tsx
import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAnswersForEmail,
  buildProfileFromAnswers,
  type AiSession,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../../lib/coach/ai";

/* ======================== Utils ======================== */
function parseStore(val?: string | null): { sessions: any[] } {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val!);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as any[] };
  } catch (e) {
    console.warn("parseStore: invalid cookie JSON", e);
  }
  return { sessions: [] };
}

function fmtDateYMD(ymd?: string) {
  if (!ymd) return "—";
  try {
    const [y, m, d] = (ymd || "").split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function normalizeWorkoutType(input?: string): WorkoutType {
  const s = String(input || "").trim().toLowerCase();
  if (["cardio", "endurance"].includes(s)) return "cardio";
  if (["hiit", "metcon", "wod"].includes(s)) return "hiit";
  if (["mobilite", "mobilité"].includes(s)) return "mobilité";
  return "muscu";
}

function genericFallback(type: WorkoutType): NormalizedExercise[] {
  if (type === "cardio")
    return [
      { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
      { name: "Cardio continu Z2", reps: "25–35 min", block: "principal" },
      { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" },
    ];
  if (type === "mobilité")
    return [
      { name: "Respiration diaphragmatique", reps: "2–3 min", block: "echauffement" },
      { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
      { name: "T-spine rotations", reps: "8–10/ côté", block: "principal" },
      { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
    ];
  return [
    { name: "Goblet Squat", sets: 3, reps: "8–12", rest: "75s", equipment: "haltères", block: "principal" },
    { name: "Développé haltères", sets: 3, reps: "8–12", rest: "75s", equipment: "haltères", block: "principal" },
    { name: "Rowing unilatéral", sets: 3, reps: "10–12/ côté", rest: "75s", equipment: "haltères", block: "principal" },
    { name: "Planche", sets: 2, reps: "30–45s", rest: "45s", equipment: "poids du corps", block: "fin" },
  ];
}

export const dynamic = "force-dynamic";

/* ======================== Styles & Const ======================== */
const blockNames: Record<string, string> = {
  echauffement: "Échauffement",
  principal: "Bloc principal",
  accessoires: "Accessoires",
  fin: "Fin / retour au calme",
};

const styles = String.raw`
  .compact-card { padding: 12px; border-radius: 16px; background:#fff; box-shadow: 0 1px 0 rgba(17,24,39,.05); border:1px solid #e5e7eb; }
  .h1-compact { margin-bottom:2px; font-size: clamp(20px, 2.2vw, 24px); line-height:1.15; font-weight:800; }
  .lead-compact { margin-top:4px; font-size: clamp(12px, 1.6vw, 14px); line-height:1.35; color:#4b5563; }
  .section-title { font-size: clamp(16px,1.9vw,18px); line-height:1.2; margin:0; font-weight:800; }
  .exoname { font-size: 15.5px; line-height:1.25; font-weight:700; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .btn { display:inline-flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid #e5e7eb; background:#111827; color:#fff; font-weight:700; padding:8px 12px; line-height:1.2; }
`;

/* ======================== Helpers ======================== */
function goalLabelFromProfile(profile: any): string | undefined {
  if (!profile) return undefined;
  const raw = String(profile?.objectif ?? "").trim();
  if (raw) return raw;
  const map: Record<string, string> = {
    hypertrophy: "Hypertrophie / Esthétique",
    fatloss: "Perte de gras",
    strength: "Force",
    endurance: "Endurance / Cardio",
    mobility: "Mobilité / Souplesse",
    general: "Forme générale",
  };
  const key = String(
    profile?.goal ??
      profile?.primaryGoal ??
      profile?.objective ??
      profile?.mainObjective ??
      profile?.currentGoal ??
      ""
  ).toLowerCase();
  return map[key] || undefined;
}

/* ======================== UI ======================== */
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

/* ======================== Page ======================== */
export default async function Page({
  params,
  searchParams,
}: {
  params: { id?: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = decodeURIComponent(params?.id ?? "");
  const cookieStore = cookies();
  const store = parseStore(cookieStore.get("app_sessions")?.value);

  const base = store.sessions.find((s) => s.id === id) as AiSession | undefined;
  if (!base) redirect("/dashboard/profile?error=Seance%20introuvable");

  // Récupère profil IA depuis les réponses
  let profile = null;
  try {
    const email = cookieStore.get("app_email")?.value;
    if (email) {
      const answers = await getAnswersForEmail(email);
      if (answers) profile = buildProfileFromAnswers(answers);
    }
  } catch {}

  const exercises: NormalizedExercise[] = base?.exercises?.length
    ? base.exercises
    : genericFallback(base?.type as WorkoutType);

  const plannedMin = base?.plannedMin ?? profile?.timePerSession ?? 45;
  const intensity = base?.intensity ?? "modérée";
  const goalLabel = goalLabelFromProfile(profile);
  const blockOrder = { echauffement: 0, principal: 1, accessoires: 2, fin: 3 } as const;

  const exs = exercises.slice().sort((a, b) => {
    const A = a.block ? (blockOrder as any)[a.block] ?? 99 : 50;
    const B = b.block ? (blockOrder as any)[b.block] ?? 99 : 50;
    return A - B;
  });

  const groups: Record<string, NormalizedExercise[]> = {};
  for (const ex of exs) {
    const k = ex.block || "principal";
    (groups[k] ||= []).push(ex);
  }

  const coachIntro =
    base.type === "muscu"
      ? "Exécution propre, contrôle du tempo et progression des charges."
      : base.type === "cardio"
      ? "Aérobie maîtrisée, souffle régulier en zone 2–3."
      : base.type === "hiit"
      ? "Pics d’intensité courts, technique impeccable."
      : "Mouvement lent et contrôlé, respire profondément.";

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="mx-auto w-full" style={{ maxWidth: 640, paddingInline: 12, paddingBottom: 24 }}>
        <a href="/dashboard/profile" className="btn mb-4">← Retour</a>

        <h1 className="h1-compact">{base.title}</h1>
        <p className="lead-compact">
          {fmtDateYMD(base.date)} · {plannedMin} min · {base.type}
        </p>

        <div className="compact-card mt-4">
          {goalLabel && <div>🎯 <b>Objectif actuel :</b> {goalLabel}</div>}
          <div>🧭 <b>Intention :</b> {coachIntro}</div>
          <div>⏱️ <b>Durée :</b> {plannedMin} min</div>
          {profile?.equipLevel && (
            <div>
              🧰 <b>Matériel :</b>{" "}
              {profile.equipLevel === "full"
                ? "Accès salle (machines/barres)"
                : profile.equipLevel === "limited"
                ? `Limité (${profile.equipItems?.join(", ") || "quelques charges"})`
                : "Aucun (poids du corps)"}
            </div>
          )}
        </div>

        {["echauffement", "principal", "accessoires", "fin"].map((k) => {
          const list = groups[k] || [];
          if (!list.length) return null;
          return (
            <section key={k} className="section mt-4">
              <h2 className="section-title mb-2">{blockNames[k]}</h2>
              <div className="grid gap-3">
                {list.map((ex, i) => (
                  <article key={`${k}-${i}`} className="compact-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="exoname">{ex.name}</div>
                    </div>
                    <div className="chips">
                      {typeof ex.sets === "number" && (
                        <Chip label="🧱" value={`${ex.sets} séries`} title="Séries" />
                      )}
                      {ex.reps && <Chip label="🔁" value={ex.reps} title="Répétitions" />}
                      {ex.rest && <Chip label="⏲️" value={ex.rest} title="Repos" />}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

