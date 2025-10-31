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
    // @ts-ignore
    const { getServerSession } = await import("next-auth");
    // @ts-ignore
    const { authOptions } = await import("../../../../lib/auth");
    const session = await getServerSession(authOptions as any);
    const email = (session as any)?.user?.email as string | undefined;
    if (email) return email;
  } catch {
    //
  }
  return cookies().get("app_email")?.value || "";
}

function parseStore(val?: string | null): { sessions: any[] } {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val!);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as any[] };
  } catch {}
  return { sessions: [] };
}

function fmtDateYMD(ymd?: string) {
  if (!ymd) return "—";
  try {
    const [y, m, d] = ymd.split("-").map(Number);
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
      { name: "Retour au calme", reps: "5–8 min", block: "fin" },
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
    { name: "Gainage", sets: 2, reps: "30–45s", rest: "45s", block: "fin" },
  ];
}

/* -------- Type étendu du profil -------- */
type ProfileT = ReturnType<typeof buildProfileFromAnswers> & {
  timePerSession?: number;
  equipLevel?: "none" | "limited" | "full";
  equipItems?: string[];
  injuries?: string[];
  level?: "debutant" | "intermediaire" | "avance";
  goal?: string;
};

/* ====================== Data Loader ====================== */
async function loadData(
  id: string,
  searchParams?: Record<string, string | string[] | undefined>
): Promise<{
  base?: AiSession;
  profile: ProfileT | null;
  exercises: NormalizedExercise[];
  dataSource: string;
  activeEquip: "full" | "none";
}> {
  const debug = String(searchParams?.debug || "") === "1";
  const forceRegen = String(searchParams?.regen || "") === "1";

  const equipParam = String(searchParams?.equip || "").toLowerCase();
  let activeEquip: "full" | "none" = equipParam === "none" ? "none" : "full";

  const qpTitle = typeof searchParams?.title === "string" ? searchParams.title : "";
  const qpDateRaw = typeof searchParams?.date === "string" ? searchParams.date : "";
  const qpType = normalizeWorkoutType(
    typeof searchParams?.type === "string" ? searchParams.type : ""
  );
  const qpPlannedMin =
    typeof searchParams?.plannedMin === "string" && searchParams.plannedMin
      ? Number(searchParams.plannedMin)
      : undefined;

  const today = new Date();
  const qpDate =
    qpDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(qpDateRaw)
      ? qpDateRaw
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
          today.getDate()
        ).padStart(2, "0")}`;

  const store = parseStore(cookies().get("app_sessions")?.value);
  const fromStore = store.sessions.find((s) => s.id === id) as
    | (AiSession & { exercises?: NormalizedExercise[] })
    | undefined;

  let aiSessions: AiSession[] = [];
  try {
    const email = await getSignedInEmail();
    aiSessions = email ? await getAiSessions(email) : [];
  } catch {
    aiSessions = [];
  }
  const fromAi = aiSessions.find((s) => s.id === id);

  let dataSource = "unknown";
  let base: AiSession | undefined = fromStore || fromAi;
  if (fromStore) dataSource = "store";
  else if (fromAi) dataSource = "ai";

  if (!base && (qpTitle || qpDateRaw || searchParams?.type)) {
    dataSource = "stub";
    base = {
      id: id || "stub",
      title: qpTitle || "Séance personnalisée",
      date: qpDate,
      type: qpType,
      plannedMin: qpPlannedMin,
    } as AiSession;
  }

  let profile: ProfileT | null = null;
  try {
    const email = await getSignedInEmail();
    if (email) {
      const answers = await getAnswersForEmail(email);
      if (answers) profile = buildProfileFromAnswers(answers) as ProfileT;
    }
  } catch {}

  if (!equipParam) {
    activeEquip = profile?.equipLevel === "none" ? "none" : "full";
  }

  let exercises: NormalizedExercise[] =
    (fromStore?.exercises as NormalizedExercise[] | undefined) ||
    (fromAi?.exercises as NormalizedExercise[] | undefined) ||
    [];

  if (forceRegen || !exercises.length) {
    try {
      const email = await getSignedInEmail();
      if (email) {
        const answers = await getAnswersForEmail(email);
        if (answers) {
          if (equipParam) (answers as any).equipLevel = equipParam;
          const regenProg = generateProgrammeFromAnswers(answers);
          const regen = regenProg.sessions || [];
          const match =
            regen.find(
              (s) =>
                s.title === base?.title &&
                s.type === base?.type &&
                (s.date === base?.date || !base?.date)
            ) || regen[0];
          if (match?.exercises?.length) {
            exercises = match.exercises;
            if (!forceRegen && dataSource === "unknown") dataSource = "regen";
          }
        }
      }
    } catch (e) {
      console.warn("generateProgrammeFromAnswers failed", e);
    }
  }

  if (!exercises.length) {
    exercises = genericFallback((base?.type ?? "muscu") as WorkoutType);
    if (dataSource === "unknown") dataSource = "fallback";
  }

  if (debug) console.log("seance page dataSource=", dataSource, { id, activeEquip });
  return { base, profile, exercises, dataSource, activeEquip };
}

/* ======================== Styles ======================== */
const styles = String.raw`
  .compact-card { padding: 12px; border-radius: 16px; background:#fff; border:1px solid #e5e7eb; }
  .h1-compact { font-weight:800; font-size:22px; }
  .lead-compact { font-size:14px; color:#4b5563; }
`;

/* ======================== Page principale ======================== */
export default async function Page({
  params,
  searchParams,
}: {
  params: { id?: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = decodeURIComponent(params?.id ?? "");
  if (!id) redirect("/dashboard/profile?error=Seance%20introuvable");

  const { base, profile, exercises, dataSource, activeEquip } = await loadData(id, searchParams);
  if (!base) redirect("/dashboard/profile?error=Seance%20introuvable");

  const plannedMin = base?.plannedMin ?? profile?.timePerSession ?? 45;
  const intensity = base?.intensity ?? "modérée";

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 640, paddingInline: 12, paddingBottom: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <h1 className="h1-compact">{base.title}</h1>
      <p className="lead-compact">
        {fmtDateYMD(base.date)} · {plannedMin} min · {base.type}
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Source: <b>{dataSource}</b> | Mode équipement: <b>{activeEquip}</b>
      </p>
    </div>
  );
}
