// apps/web/app/dashboard/seance/[id]/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";
import { PageHeader, Section } from "@/components/ui/Page";
import PrintButton from "./PrintButton";

import {
  getProgrammeForUser,
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  type AiSession,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../../lib/coach/ai";

/* -------------------- utils compacts -------------------- */
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
  try { const o = JSON.parse(val!); if (Array.isArray(o?.sessions)) return { sessions: o.sessions as any[] }; } catch {}
  return { sessions: [] };
}
function fmtDateYMD(ymd?: string) {
  if (!ymd) return "—";
  try { const [y,m,d]=ymd.split("-").map(Number); return new Date(y,(m||1)-1,d||1).toLocaleDateString("fr-FR",{year:"numeric",month:"long",day:"numeric"}); } catch { return "—"; }
}
function normalizeWorkoutType(input?: string): WorkoutType {
  const s = String(input || "").trim().toLowerCase();
  if (["cardio","endurance"].includes(s)) return "cardio";
  if (["hiit","metcon","wod"].includes(s)) return "hiit";
  if (["mobilite","mobilité","mobilité"].includes(s)) return "mobilité";
  return "muscu";
}
function genericFallback(type: WorkoutType): NormalizedExercise[] {
  if (type === "cardio") return [
    { name:"Échauffement Z1", reps:"8–10 min", block:"echauffement" },
    { name:"Cardio continu Z2", reps:"25–35 min", block:"principal" },
    { name:"Retour au calme + mobilité", reps:"5–8 min", block:"fin" },
  ];
  if (type === "mobilité") return [
    { name:"Respiration diaphragmatique", reps:"2–3 min", block:"echauffement" },
    { name:"90/90 hanches", reps:"8–10/ côté", block:"principal" },
    { name:"T-spine rotations", reps:"8–10/ côté", block:"principal" },
    { name:"Down-Dog → Cobra", reps:"6–8", block:"fin" },
  ];
  return [
    { name:"Goblet Squat", sets:3, reps:"8–12", rest:"75s", equipment:"haltères", block:"principal" },
    { name:"Développé haltères", sets:3, reps:"8–12", rest:"75s", equipment:"haltères", block:"principal" },
    { name:"Rowing unilatéral", sets:3, reps:"10–12/ côté", rest:"75s", equipment:"haltères", block:"principal" },
    { name:"Planche", sets:2, reps:"30–45s", rest:"45s", equipment:"poids du corps", block:"fin" },
  ];
}

export const dynamic = "force-dynamic";

/* -------------------- data loader -------------------- */
async function loadData(id: string, searchParams?: Record<string,string|string[]|undefined>) {
  const store = parseStore(cookies().get("app_sessions")?.value);
  const fromStore = store.sessions.find((s)=>s.id===id) as (AiSession & {exercises?:NormalizedExercise[]})|undefined;

  let programme: { sessions: AiSession[] } | null = null;
  try { programme = await getProgrammeForUser(); } catch { programme = null; }
  const fromAi = programme?.sessions?.find((s)=>s.id===id);

  const qpTitle = typeof searchParams?.title === "string" ? searchParams!.title : "";
  const qpDateRaw = typeof searchParams?.date  === "string" ? searchParams!.date  : "";
  const qpType = normalizeWorkoutType(typeof searchParams?.type === "string" ? searchParams!.type : "");
  const qpPlannedMin = typeof searchParams?.plannedMin === "string" && searchParams!.plannedMin ? Number(searchParams!.plannedMin) : undefined;

  const today = new Date();
  const qpDate = qpDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(qpDateRaw)
    ? qpDateRaw
    : `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const key = (t:string,d:string,ty:string)=>`${t}|${d}|${ty}`;
  const storeByQD = !fromStore && qpTitle ? store.sessions.find(s=>key(s.title,s.date,s.type)===key(qpTitle,qpDate,qpType)) : undefined;
  const aiByQD    = !fromAi && qpTitle && programme ? programme.sessions.find(s=>key(s.title,s.date,s.type)===key(qpTitle,qpDate,qpType)) : undefined;

  let base: AiSession | undefined = (fromStore as AiSession|undefined) || fromAi || (storeByQD as AiSession|undefined) || aiByQD;
  if (!base && (qpTitle || qpDateRaw || (searchParams?.type as string|undefined))) {
    base = { id:"stub", title: qpTitle || "Séance personnalisée", date: qpDate, type: qpType, plannedMin: qpPlannedMin } as AiSession;
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
    (fromStore?.exercises as NormalizedExercise[]|undefined) ||
    ((fromAi as any)?.exercises as NormalizedExercise[]|undefined) ||
    [];

  if (!exercises.length) {
    try {
      const email = await getSignedInEmail();
      if (email) {
        const answers = await getAnswersForEmail(email);
        if (answers) {
          const regen = generateProgrammeFromAnswers(answers);
          const match = regen.find(s=>s.title===base?.title && s.type===base?.type && (s.date===base?.date || !base?.date)) || regen[0];
          if (match?.exercises?.length) exercises = match.exercises;
        }
      }
    } catch {}
  }
  if (!exercises.length) exercises = genericFallback((base?.type ?? "muscu") as WorkoutType);

  return { base, profile, exercises };
}

/* -------------------- page -------------------- */
export default async function Page({
  params, searchParams,
}: { params: { id?: string }, searchParams?: Record<string,string|string[]|undefined> }) {

  const id = decodeURIComponent(params?.id ?? "");
  if (!id && !(searchParams?.title || searchParams?.date || searchParams?.type)) {
    redirect("/dashboard/profile?error=Seance%20introuvable");
  }

  const { base, profile, exercises } = await loadData(id, searchParams);
  if (!base) redirect("/dashboard/profile?error=Seance%20introuvable");

  const plannedMin = base.plannedMin ?? (profile?.timePerSession ?? 45);
  const intensity  = base.intensity ?? "modérée";

  const coachIntro =
    base.type === "muscu" ? "Exécution propre, contrôle du tempo et progression des charges."
  : base.type === "cardio" ? "Aérobie maîtrisée, souffle régulier en zone 2–3."
  : base.type === "hiit"   ? "Pics d’intensité courts, technique impeccable."
  : "Amplitude confortable, respiration calme, zéro douleur nette.";

  const blockOrder = { echauffement:0, principal:1, accessoires:2, fin:3 } as const;
  const labels: Record<string,string> = {
    echauffement: "Échauffement",
    principal: "Bloc principal",
    accessoires: "Accessoires",
    fin: "Fin / retour au calme",
  };
  const exs = exercises.slice().sort((a,b)=>{
    const A = a.block ? blockOrder[a.block] ?? 99 : 50;
    const B = b.block ? blockOrder[b.block] ?? 99 : 50;
    return A - B;
  });
  const groups = exs.reduce<Record<string, NormalizedExercise[]>>((acc,ex)=>{
    const k = ex.block || "principal"; (acc[k] ||= []).push(ex); return acc;
  }, {});

  return (
    <>
      {/* top bar compacte comme recipes */}
      <div className="mb-2 flex items-center justify-between">
        <a
          href="/dashboard/seances"
          className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          ← Retour
        </a>
        <PrintButton />
      </div>

      {/* titres avec clamp() ~ recipes */}
      <PageHeader
        title={
          <span style={{ fontSize: "clamp(20px, 2.2vw, 24px)", lineHeight: 1.15 }}>
            {base.title}
          </span>
        }
        subtitle={
          <span style={{ fontSize: "clamp(12px, 1.6vw, 14px)", color: "#4b5563" }}>
            {fmtDateYMD(base.date)} · {plannedMin} min · {base.type}
          </span>
        }
      />

      <Section title={<span style={{ fontSize: "clamp(16px,1.9vw,18px)" }}>Brief de séance</span>}>
        <div className="card" style={{ padding: 12 }}>
          <ul className="space-y-1.5" style={{ fontSize: 14, lineHeight: 1.5 }}>
            <li>🎯 <b>Objectif</b> : {coachIntro}</li>
            <li>⏱️ <b>Durée</b> : {plannedMin} min · <b>Intensité</b> : {intensity}</li>
            {profile?.equipLevel && (
              <li>
                🧰 <b>Matériel</b> :{" "}
                {profile.equipLevel === "full"
                  ? "accès salle (machines/barres)"
                  : profile.equipLevel === "limited"
                  ? `limité (${profile.equipItems.join(", ") || "quelques charges"})`
                  : "aucun (poids du corps)"}
              </li>
            )}
            {profile?.injuries?.length ? (
              <li style={{ color: "#92400e" }}>⚠️ <b>Prudence</b> : {profile.injuries.join(", ")}</li>
            ) : null}
            <li>💡 <b>Conseils</b> : {
              base.type === "muscu" ? "Laisse 1–2 reps en réserve sur la dernière série."
              : base.type === "cardio" ? "Reste en Z2 : tu dois pouvoir parler en phrases courtes."
              : base.type === "hiit" ? "Coupe une série si la technique se dégrade."
              : "Mouvement lent et contrôlé, respire profondément."
            }</li>
          </ul>
        </div>
      </Section>

      {/* blocs — cards compactes, typos 13px */}
      {(["echauffement","principal","accessoires","fin"] as const).map((k) => {
        const list = groups[k] || [];
        if (!list.length) return null;
        return (
          <Section key={k} title={<span style={{ fontSize: "clamp(16px,1.9vw,18px)" }}>{labels[k]}</span>}>
            <div className="grid gap-3">
              {list.map((ex, i) => (
                <div key={`${k}-${i}`} className="card" style={{ padding: 12 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold" style={{ fontSize: 16, lineHeight: 1.25 }}>
                      {ex.name}
                    </div>
                    {ex.block ? (
                      <span className="shrink-0 rounded-full bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 ring-1 ring-neutral-200">
                        {labels[ex.block] || ex.block}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-4" style={{ fontSize: 13, lineHeight: 1.45 }}>
                    <div>
                      <span className="label !mb-1">Séries</span>
                      <div>{typeof ex.sets==="number" ? ex.sets : "—"}</div>
                    </div>
                    <div>
                      <span className="label !mb-1">Rép./Durée</span>
                      <div>{ex.reps ? String(ex.reps) : ex.durationSec ? `${ex.durationSec}s` : "—"}</div>
                    </div>
                    <div>
                      <span className="label !mb-1">Repos</span>
                      <div>{ex.rest || "—"}</div>
                    </div>
                    <div>
                      <span className="label !mb-1">Charge / Tempo</span>
                      <div>
                        {ex.load || (typeof ex.rir==="number" ? `RIR ${ex.rir}` : "—")}
                        {ex.tempo ? ` · ${ex.tempo}` : ""}
                      </div>
                    </div>
                  </div>

                  {(ex.target || ex.equipment || ex.alt || ex.notes || ex.videoUrl) && (
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2" style={{ fontSize: 12.5, color: "#6b7280" }}>
                      {ex.target && <div>🎯 {ex.target}</div>}
                      {ex.equipment && <div>🧰 {ex.equipment}</div>}
                      {ex.alt && <div>🔁 Alt: {ex.alt}</div>}
                      {ex.notes && <div>📝 {ex.notes}</div>}
                      {ex.videoUrl && (
                        <div>📺 <a className="underline underline-offset-2" href={ex.videoUrl} target="_blank" rel="noreferrer">Vidéo</a></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}
