import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

import {
  getProgrammeForUser,
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  type AiSession,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../../lib/coach/ai";
import PrintButton from "./PrintButton";

/* ======================= Utils ======================= */
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

function parseStore(val?: string | null): { sessions: any[] } {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as any[] };
  } catch {}
  return { sessions: [] };
}

function isValidDate(d: Date) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}
function fmtDateYMD(ymd?: string) {
  if (!ymd) return "—";
  try {
    const [y, m, d] = ymd.split("-").map((n) => Number(n));
    const dt = new Date(y || 0, (m || 1) - 1, d || 1);
    if (!isValidDate(dt)) return "—";
    return dt.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "—";
  }
}
function normalizeWorkoutType(input?: string): WorkoutType {
  const s = String(input || "").trim().toLowerCase();
  if (["muscu", "musculation", "strength"].includes(s)) return "muscu";
  if (["cardio", "endurance"].includes(s)) return "cardio";
  if (["hiit", "metcon", "wod"].includes(s)) return "hiit";
  if (["mobilite", "mobilité", "mobilité"].includes(s)) return "mobilité";
  return "muscu";
}
function typeBadgeClass(t: WorkoutType) {
  switch (t) {
    case "muscu": return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "cardio": return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "hiit":  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "mobilité": return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }
  return "";
}

/** Baseline si vraiment rien à afficher */
function genericFallback(type: WorkoutType): NormalizedExercise[] {
  if (type === "cardio") {
    return [
      { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
      { name: "Cardio continu Z2", reps: "25–35 min", block: "principal" },
      { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" },
    ];
  }
  if (type === "mobilité") {
    return [
      { name: "Respiration diaphragmatique", reps: "2–3 min", block: "echauffement" },
      { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
      { name: "T-spine rotations", reps: "8–10/ côté", block: "principal" },
      { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
    ];
  }
  return [
    { name: "Goblet Squat", sets: 3, reps: "8–12", rest: "75s", equipment: "haltères", block: "principal" },
    { name: "Développé haltères", sets: 3, reps: "8–12", rest: "75s", equipment: "haltères", block: "principal" },
    { name: "Rowing unilatéral", sets: 3, reps: "10–12/ côté", rest: "75s", equipment: "haltères", block: "principal" },
    { name: "Planche", sets: 2, reps: "30–45s", rest: "45s", equipment: "poids du corps", block: "fin" },
  ];
}

export const dynamic = "force-dynamic";

/* ======================= Data loader ======================= */
async function loadData(
  id: string,
  searchParams?: Record<string, string | string[] | undefined>
) {
  const store = parseStore(cookies().get("app_sessions")?.value);
  const fromStore = store.sessions.find((s) => s.id === id) as
    | (AiSession & { exercises?: NormalizedExercise[] })
    | undefined;

  let programme: { sessions: AiSession[] } | null = null;
  try {
    programme = await getProgrammeForUser();
  } catch {
    programme = null;
  }
  const fromAi = programme?.sessions?.find((s) => s.id === id);

  const qpTitle = typeof searchParams?.title === "string" ? searchParams!.title : "";
  const qpDateRaw = typeof searchParams?.date === "string" ? searchParams!.date : "";
  const qpType = normalizeWorkoutType(
    typeof searchParams?.type === "string" ? searchParams!.type : ""
  );
  const qpPlannedMin =
    typeof searchParams?.plannedMin === "string" && searchParams!.plannedMin
      ? Number(searchParams!.plannedMin)
      : undefined;

  const today = new Date();
  const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const qpDate = qpDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(qpDateRaw) ? qpDateRaw : todayYMD;

  const key = (t: string, d: string, ty: string) => `${t}|${d}|${ty}`;
  const storeByQD =
    !fromStore && qpTitle
      ? store.sessions.find((s) => key(s.title, s.date, s.type) === key(qpTitle, qpDate, qpType))
      : undefined;

  const aiByQD =
    !fromAi && qpTitle && programme
      ? programme.sessions.find((s) => key(s.title, s.date, s.type) === key(qpTitle, qpDate, qpType))
      : undefined;

  let base: AiSession | undefined =
    (fromStore as AiSession | undefined) ||
    fromAi ||
    (storeByQD as AiSession | undefined) ||
    aiByQD;

  if (!base && (qpTitle || qpDateRaw || (searchParams?.type as string | undefined))) {
    base = {
      id: "stub",
      title: qpTitle || "Séance personnalisée",
      date: qpDate,
      type: qpType,
      plannedMin: qpPlannedMin,
    } as AiSession;
  }

  let profile: ReturnType<typeof buildProfileFromAnswers> | null = null;
  try {
    const email = await getSignedInEmail();
    if (email) {
      const answers = await getAnswersForEmail(email);
      if (answers) profile = buildProfileFromAnswers(answers);
    }
  } catch {}

  let exercises: NormalizedExercise[] =
    (fromStore?.exercises as NormalizedExercise[] | undefined) ||
    ((fromAi as any)?.exercises as NormalizedExercise[] | undefined) ||
    [];

  if (!exercises.length) {
    try {
      const email = await getSignedInEmail();
      if (email) {
        const answers = await getAnswersForEmail(email);
        if (answers) {
          const regen = generateProgrammeFromAnswers(answers);
          const match =
            regen.find(
              (s) =>
                s.title === base?.title &&
                s.type === base?.type &&
                (s.date === base?.date || !base?.date)
            ) || regen[0];
          if (match?.exercises?.length) exercises = match.exercises;
        }
      }
    } catch {}
  }

  if (!exercises.length) {
    exercises = genericFallback((base?.type ?? "muscu") as WorkoutType);
  }

  return { base, profile, exercises };
}

/* ======================= Page ======================= */
export default async function Page({
  params,
  searchParams,
}: {
  params: { id?: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = decodeURIComponent(params?.id ?? "");
  if (!id && !(searchParams?.title || searchParams?.date || searchParams?.type)) {
    redirect("/dashboard/profile?error=Seance%20introuvable");
  }

  const { base, profile, exercises } = await loadData(id, searchParams);
  if (!base) redirect("/dashboard/profile?error=Seance%20introuvable");

  // Tri par bloc + groupement
  const blockOrder = { echauffement: 0, principal: 1, accessoires: 2, fin: 3 } as const;
  const labelByBlock: Record<string, string> = {
    echauffement: "Échauffement",
    principal: "Bloc principal",
    accessoires: "Accessoires",
    fin: "Fin / retour au calme",
  };
  const exsSorted = exercises.slice().sort((a, b) => {
    const A = a.block ? blockOrder[a.block] ?? 99 : 50;
    const B = b.block ? blockOrder[b.block] ?? 99 : 50;
    return A - B;
  });
  const groups = exsSorted.reduce<Record<string, NormalizedExercise[]>>((acc, ex) => {
    const k = ex.block || "principal";
    acc[k] = acc[k] || [];
    acc[k].push(ex);
    return acc;
  }, {});

  const plannedMin = base!.plannedMin ?? (profile?.timePerSession ?? 45);
  const intensity = base!.intensity ?? "modérée";

  const coachIntro =
    base!.type === "muscu"
      ? "Exécution propre, contrôle du tempo et progression des charges."
      : base!.type === "cardio"
      ? "Aérobie maîtrisée, souffle régulier en zone 2–3."
      : base!.type === "hiit"
      ? "Pics d’intensité courts, technique impeccable."
      : "Amplitude confortable, respiration calme, zéro douleur nette.";

  const coachTips =
    base!.type === "muscu"
      ? "Laisse 1–2 reps en réserve sur la dernière série."
      : base!.type === "cardio"
      ? "Reste en Z2 : tu dois pouvoir parler en phrases courtes."
      : base!.type === "hiit"
      ? "Coupe une série si la technique se dégrade."
      : "Mouvement lent et contrôlé, respire profondément.";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          main { padding: 0 !important; }
          h1, h2 { break-after: avoid; }
          .block-title { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Header sticky */}
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between bg-white/85 py-2 backdrop-blur no-print">
        <a
          href="/dashboard/seances"
          className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
        >
          ← Retour
        </a>
        <PrintButton />
      </div>

      {/* Card */}
      <section className="card rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        {/* Top */}
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {base!.title}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              <b className="font-medium text-neutral-700">{fmtDateYMD(base!.date)}</b>
              {plannedMin ? ` · ${plannedMin} min` : ""}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(base!.type)}`}>
            {base!.type}
          </span>
        </header>

        {/* Meta coach */}
        <div className="mt-4 grid gap-3 rounded-xl bg-neutral-50 p-4 text-[13px] leading-6 text-neutral-700 sm:grid-cols-2">
          <div>🎯 <b>Objectif :</b> {coachIntro}</div>
          <div>⏱️ <b>Durée :</b> {plannedMin} min · <b>Intensité :</b> {intensity}</div>
          {profile?.injuries?.length ? (
            <div className="sm:col-span-2 text-amber-700">
              ⚠️ <b>Prudence :</b> {profile.injuries.join(", ")}
            </div>
          ) : null}
          {profile?.equipLevel ? (
            <div className="sm:col-span-2 text-neutral-600">
              🧰 <b>Matériel :</b>{" "}
              {profile.equipLevel === "full"
                ? "accès salle (machines/barres)"
                : profile.equipLevel === "limited"
                ? `limité (${profile.equipItems.join(", ") || "quelques charges"})`
                : "aucun (poids du corps)"}
            </div>
          ) : null}
          <div className="sm:col-span-2 text-neutral-600">
            💡 <b>Conseils :</b> {coachTips}
          </div>
        </div>

        {/* Contenu par blocs (pro + lisible) */}
        <div className="mt-6 space-y-6">
          {(["echauffement","principal","accessoires","fin"] as const).map((bkey) => {
            const list = groups[bkey] || [];
            if (!list.length) return null;
            return (
              <section key={bkey}>
                <div className="block-title sticky top-12 z-[1] -mx-5 mb-2 border-b border-neutral-200 bg-white/80 px-5 py-2 backdrop-blur">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                    {labelByBlock[bkey]}
                  </h2>
                </div>

                {/* Table desktop */}
                <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Exercice</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Séries</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Rép./Durée</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Repos</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Charge</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Tempo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white">
                      {list.map((ex, i) => (
                        <tr key={`${bkey}-${i}`} className="align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium text-neutral-900">{ex.name}</div>
                            <div className="mt-0.5 text-xs text-neutral-500 space-x-2">
                              {ex.target ? <span>{ex.target}</span> : null}
                              {ex.equipment ? <span>• Matériel: {ex.equipment}</span> : null}
                              {ex.alt ? <span>• Alt: {ex.alt}</span> : null}
                              {ex.videoUrl ? (
                                <span>• <a className="underline underline-offset-2" href={ex.videoUrl} target="_blank" rel="noreferrer">Vidéo</a></span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm">{typeof ex.sets === "number" ? ex.sets : "—"}</td>
                          <td className="px-3 py-3 text-sm">{ex.reps ? String(ex.reps) : ex.durationSec ? `${ex.durationSec}s` : "—"}</td>
                          <td className="px-3 py-3 text-sm">{ex.rest || "—"}</td>
                          <td className="px-3 py-3 text-sm">{ex.load || (typeof ex.rir === "number" ? `RIR ${ex.rir}` : "—")}</td>
                          <td className="px-3 py-3 text-sm">{ex.tempo || "—"}</td>
                          <td className="px-4 py-3 text-sm whitespace-pre-wrap">{ex.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cartes mobile */}
                <div className="md:hidden space-y-3">
                  {list.map((ex, i) => (
                    <div key={`m-${bkey}-${i}`} className="rounded-xl border border-neutral-200 p-3">
                      <div className="font-medium">{ex.name}</div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-[13px] text-neutral-700">
                        <div><span className="text-neutral-500">Séries: </span>{typeof ex.sets === "number" ? ex.sets : "—"}</div>
                        <div><span className="text-neutral-500">Rép./Durée: </span>{ex.reps ? String(ex.reps) : ex.durationSec ? `${ex.durationSec}s` : "—"}</div>
                        <div><span className="text-neutral-500">Repos: </span>{ex.rest || "—"}</div>
                        <div><span className="text-neutral-500">Charge: </span>{ex.load || (typeof ex.rir === "number" ? `RIR ${ex.rir}` : "—")}</div>
                      </div>
                      {(ex.target || ex.equipment || ex.alt || ex.notes || ex.videoUrl) && (
                        <div className="mt-2 space-y-1 text-[12px] text-neutral-600">
                          {ex.target ? <div>🎯 {ex.target}</div> : null}
                          {ex.equipment ? <div>🧰 {ex.equipment}</div> : null}
                          {ex.alt ? <div>🔁 Alt: {ex.alt}</div> : null}
                          {ex.notes ? <div>📝 {ex.notes}</div> : null}
                          {ex.videoUrl ? <div>📺 <a className="underline underline-offset-2" href={ex.videoUrl} target="_blank" rel="noreferrer">Vidéo</a></div> : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <footer className="no-print mx-auto mt-6 text-center text-xs text-neutral-400">
        Files Coaching · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
