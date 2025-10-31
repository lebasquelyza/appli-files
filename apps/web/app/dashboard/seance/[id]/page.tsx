// apps/web/app/dashboard/seance/[id]/page.tsx
import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAiSessions,
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  type AiSession,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../../lib/coach/ai";

/* ======================== Utils ======================== */
async function getSignedInEmail(): Promise<string> {
  try {
    // @ts-ignore optional
    const { getServerSession } = await import("next-auth");
    // @ts-ignore optional
    const { authOptions } = await import("../../../../lib/auth");
    const session = await getServerSession(authOptions as any);
    const email = (session as any)?.user?.email as string | undefined;
    if (email) return email;
  } catch {}
  return cookies().get("app_email")?.value || "";
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
      { name: "Retour au calme", reps: "5–8 min", block: "fin" },
    ];
  if (type === "mobilité")
    return [
      { name: "Respiration diaphragmatique", reps: "3 min", block: "echauffement" },
      { name: "90/90 hanches", reps: "10/ côté", block: "principal" },
      { name: "T-spine rotations", reps: "10/ côté", block: "principal" },
      { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
    ];
  return [
    { name: "Squat goblet", sets: 3, reps: "8–12", rest: "75s", block: "principal" },
    { name: "Développé haltères", sets: 3, reps: "8–12", rest: "75s", block: "principal" },
    { name: "Rowing unilatéral", sets: 3, reps: "10–12/ côté", rest: "75s", block: "principal" },
    { name: "Gainage planche", sets: 2, reps: "30–45s", rest: "45s", block: "fin" },
  ];
}

/* ======================== Data Loader ======================== */
async function loadData(id: string, searchParams?: Record<string, string | string[] | undefined>) {
  const email = await getSignedInEmail();
  if (!email) return null;

  // IA: recharge à partir du profil Sheet
  const answers = await getAnswersForEmail(email);
  if (!answers) return null;

  const regen = generateProgrammeFromAnswers(answers); // IA crée les séances ici
  const match =
    regen.sessions.find((s) => s.id === id) ||
    regen.sessions.find((s) => s.title.toLowerCase().includes(id.toLowerCase())) ||
    regen.sessions[0];

  if (!match) {
    return {
      base: { id, title: "Séance introuvable", type: "muscu", date: "", plannedMin: 45 },
      profile: buildProfileFromAnswers(answers),
      exercises: genericFallback("muscu"),
      dataSource: "fallback",
    };
  }

  return {
    base: match,
    profile: buildProfileFromAnswers(answers),
    exercises: match.exercises?.length ? match.exercises : genericFallback(match.type),
    dataSource: "ai",
  };
}

/* ======================== Component ======================== */
export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = decodeURIComponent(params?.id ?? "");
  if (!id) redirect("/dashboard/profile?error=Séance%20introuvable");

  const data = await loadData(id, searchParams);
  if (!data || !data.base) redirect("/dashboard/profile?error=Séance%20introuvable");

  const { base, profile, exercises } = data;
  const goalLabel =
    profile.goal === "fatloss"
      ? "Perte de gras"
      : profile.goal === "hypertrophy"
      ? "Hypertrophie"
      : profile.goal === "strength"
      ? "Force"
      : profile.goal === "mobility"
      ? "Mobilité"
      : "Forme générale";

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* ===== Titre ===== */}
      <div className="flex items-center justify-between mb-4">
        <a href="/dashboard/profile" className="text-sm text-gray-600 underline">
          ← Retour
        </a>
        <div className="text-xs text-gray-400">Programme IA</div>
      </div>

      <h1 className="text-2xl font-bold mb-1">{base.title}</h1>
      <p className="text-sm text-gray-500 mb-3 capitalize">
        {base.type} · {base.plannedMin ?? 45} min
      </p>

      {/* ===== Objectif ===== */}
      <div className="mb-4 rounded-lg border border-gray-200 p-3 bg-white shadow-sm">
        <div className="text-sm">
          🎯 <b>Objectif :</b> {goalLabel}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          💡 <b>Conseil :</b>{" "}
          {base.type === "muscu"
            ? "Contrôle du tempo, 1–2 reps en réserve."
            : base.type === "cardio"
            ? "Reste en zone 2, souffle maîtrisé."
            : base.type === "hiit"
            ? "Explosif mais propre, récupère entre les tours."
            : "Mouvements lents, respire profondément."}
        </div>
      </div>

      {/* ===== Liste des exercices ===== */}
      {exercises.map((ex, i) => (
        <div
          key={i}
          className="mb-3 border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
        >
          <div className="font-semibold text-sm">{ex.name}</div>
          <div className="text-xs text-gray-500 mt-1">
            {ex.sets ? `${ex.sets} séries` : ""}
            {ex.reps ? ` · ${ex.reps}` : ""}
            {ex.rest ? ` · Repos ${ex.rest}` : ""}
          </div>
        </div>
      ))}

      {(!exercises || exercises.length === 0) && (
        <div className="text-gray-500 text-sm">Aucun exercice disponible pour cette séance.</div>
      )}
    </div>
  );
}
