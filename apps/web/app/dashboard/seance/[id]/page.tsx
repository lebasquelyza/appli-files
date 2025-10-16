// apps/web/app/dashboard/seance/[id]/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// ⬇️ IMPORTANT: import relatif (monorepo/Netlify-safe)
import {
  getProgrammeForUser,
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  type AiSession,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../lib/coach/ai";

/* ======================= Helpers serveur ======================= */
async function getSignedInEmail(): Promise<string> {
  try {
    // @ts-ignore next-auth facultatif
    const { getServerSession } = await import("next-auth");
    // @ts-ignore
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

function fmtDateYMD(ymd?: string) {
  if (!ymd) return "—";
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return ymd;
  }
}

function typeBadgeClass(t: WorkoutType) {
  switch (t) {
    case "muscu":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "cardio":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "hiit":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "mobilité":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }
}

/** Super-baseline si vraiment rien à afficher */
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

/* ======================= Page ======================= */
export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = decodeURIComponent(params.id);

  // 1) store cookie
  const store = parseStore(cookies().get("app_sessions")?.value);
  const fromStore = store.sessions.find((s) => s.id === id) as
    | (AiSession & { exercises?: NormalizedExercise[] })
    | undefined;

  // 2) programme (API → fallback)
  const programme = await getProgrammeForUser();
  const fromAi = programme?.sessions.find((s) => s.id === id);

  // 3) support lien partagé (query)
  const qpTitle = typeof searchParams?.title === "string" ? searchParams!.title : "";
  const qpDate = typeof searchParams?.date === "string" ? searchParams!.date : "";
  const qpType = (typeof searchParams?.type === "string" ? searchParams!.type : "") as WorkoutType;
  const qpPlannedMin =
    typeof searchParams?.plannedMin === "string" && searchParams!.plannedMin
      ? Number(searchParams!.plannedMin)
      : undefined;

  const key = (t: string, d: string, ty: string) => `${t}|${d}|${ty}`;
  const storeByQD =
    !fromStore && qpTitle && qpDate && qpType
      ? store.sessions.find((s) => key(s.title, s.date, s.type) === key(qpTitle, qpDate, qpType))
      : undefined;

  const aiByQD =
    !fromAi && qpTitle && qpDate && qpType && programme
      ? programme.sessions.find((s) => key(s.title, s.date, s.type) === key(qpTitle, qpDate, qpType))
      : undefined;

  let base = (fromStore as AiSession | undefined) || fromAi || (storeByQD as AiSession | undefined) || aiByQD;

  if (!base && qpTitle && qpDate && qpType) {
    base = { id: "stub", title: qpTitle, date: qpDate, type: qpType } as AiSession;
  }

  if (!base) {
    redirect("/dashboard/profile?error=Seance%20introuvable");
  }

  // 4) profil utilisateur (pour enrichir/regen)
  const email = await getSignedInEmail();
  const answers = email ? await getAnswersForEmail(email) : null;
  const profile = answers ? buildProfileFromAnswers(answers) : null;

  // 5) exercices à afficher (store → AI → régénération → fallback)
  let exercises: NormalizedExercise[] =
    (fromStore?.exercises as NormalizedExercise[] | undefined) ||
    ((fromAi as any)?.exercises as NormalizedExercise[] | undefined) ||
    [];

  if (!exercises.length && answers) {
    const regen = generateProgrammeFromAnswers(answers);
    const match =
      regen.find(
        (s) =>
          s.title === base!.title && s.type === base!.type && (s.date === base!.date || !base!.date)
      ) ||
      regen[0];
    if (match?.exercises?.length) exercises = match.exercises;
  }

  if (!exercises.length) {
    exercises = genericFallback(base.type);
  }

  const blockOrder = { echauffement: 0, principal: 1, accessoires: 2, fin: 3 } as const;
  const exs = exercises.slice().sort((a, b) => {
    const A = a.block ? blockOrder[a.block] ?? 99 : 50;
    const B = b.block ? blockOrder[b.block] ?? 99 : 50;
    return A - B;
  });

  const plannedMin = base.plannedMin ?? (profile?.timePerSession ?? 45);
  const intensity = base.intensity ?? "modérée";
  const coachIntro =
    base.type === "muscu"
      ? "Exécution propre, contrôle du tempo et progression des charges."
      : base.type === "cardio"
      ? "Aérobie maîtrisée, souffle régulier en zone 2–3."
      : base.type === "hiit"
      ? "Pics d’intensité courts, technique impeccable."
      : "Amplitude confortable, respiration calme, zéro douleur nette.";
  const coachTips =
    base.type === "muscu"
      ? "Laisse 1–2 reps en réserve sur la dernière série."
      : base.type === "cardio"
      ? "Reste en Z2 : tu dois pouvoir parler en phrases courtes."
      : base.type === "hiit"
      ? "Coupe une série si la technique se dégrade."
      : "Mouvement lent et contrôlé, respire profondément.";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between bg-white/80 py-2 backdrop-blur no-print">
        <a
          href="/dashboard/seances"
          className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          ← Retour
        </a>
        <button
          onClick={() => (typeof window !== "undefined" ? window.print() : null)}
          className="inline-flex items-center rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
        >
          Imprimer
        </button>
      </div>

      <section className="card rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {base.title}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              <b className="font-medium text-neutral-600">{fmtDateYMD(base.date)}</b>
              {plannedMin ? ` · ${plannedMin} min` : ""}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(
              base.type
            )}`}
          >
            {base.type}
          </span>
        </header>

        <div className="mt-4 space-y-2 rounded-xl bg-neutral-50 p-4 text-[13px] leading-6 text-neutral-700">
          <div>🎯 <b>Objectif :</b> {coachIntro}</div>
          <div>⏱️ <b>Durée :</b> {plannedMin} min · <b>Intensité :</b> {intensity}</div>
          <div>💡 <b>Conseils :</b> {coachTips}</div>
          {profile?.injuries?.length ? (
            <div className="text-amber-700">
              ⚠️ <b>Prudence :</b> {profile.injuries.join(", ")}
            </div>
          ) : null}
          {profile?.equipLevel ? (
            <div className="text-neutral-600">
              🧰 <b>Matériel :</b>{" "}
              {profile.equipLevel === "full"
                ? "accès salle (machines/barres)"
                : profile.equipLevel === "limited"
                ? `limité (${profile.equipItems.join(", ") || "quelques charges"})`
                : "aucun (poids du corps)"}
            </div>
          ) : null}
        </div>

        <h2 className="mt-6 text-base font-semibold tracking-tight">Détail des exercices</h2>

        {/* Table desktop */}
        <div className="mt-2 hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Exercice</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Séries</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Rép./Durée</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Repos</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Charge</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Tempo</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Bloc</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {exs.map((ex, i) => (
                <tr key={`row-${i}`} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{ex.name}</div>
                    <div className="mt-0.5 space-x-2 text-xs text-neutral-500">
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
                  <td className="px-3 py-3 text-sm">{ex.block || "—"}</td>
                  <td className="px-4 py-3 text-sm whitespace-pre-wrap">{ex.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cartes mobile */}
        <div className="mt-2 space-y-3 md:hidden">
          {exs.map((ex, i) => (
            <div key={`mrow-${i}`} className="rounded-xl border border-neutral-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{ex.name}</div>
                <span className="rounded-full bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 ring-1 ring-neutral-200">
                  {ex.block || "—"}
                </span>
              </div>
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

      <footer className="no-print mx-auto mt-6 text-center text-xs text-neutral-400">
        Files Coaching · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
