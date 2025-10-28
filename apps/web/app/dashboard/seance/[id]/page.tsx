// apps/web/app/dashboard/seance/[id]/page.tsx
import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NextDynamic from "next/dynamic";
import {
  getAiSessions,
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  type AiSession,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../../lib/coach/ai";

/* Client-only modal (ChatGPT-powered) */
const DemoModalAI = NextDynamic(() => import("../../../../components/DemoModalAI"), { ssr: false });

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
  } catch (e) {
    console.warn("getSignedInEmail: no session", e);
  }
  return cookies().get("app_email")?.value || "";
}

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

/* ───── Types étendus ───── */
type ProfileT = ReturnType<typeof buildProfileFromAnswers> & {
  timePerSession?: number;
  equipLevel?: "none" | "limited" | "full";
  equipItems?: string[];
  injuries?: string[];
  level?: "debutant" | "intermediaire" | "avance";
  goal?: string;
  primaryGoal?: string;
  objective?: string;
  mainObjective?: string;
  currentGoal?: string;
};

export const dynamic = "force-dynamic";

/* ======================== Const ======================== */
const blockNames: Record<string, string> = {
  echauffement: "Échauffement",
  principal: "Bloc principal",
  accessoires: "Accessoires",
  fin: "Fin / retour au calme",
};

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

function openDemoHrefFor(baseId: string, searchParams: Record<string, string | undefined>, name: string) {
  const sp = new URLSearchParams();
  if (searchParams.date) sp.set("date", searchParams.date);
  if (searchParams.type) sp.set("type", searchParams.type);
  if (searchParams.title) sp.set("title", searchParams.title);
  if (searchParams.equip) sp.set("equip", searchParams.equip);
  if (searchParams.debug) sp.set("debug", searchParams.debug);
  sp.set("demo", name);
  return `/dashboard/seance/${encodeURIComponent(baseId)}?${sp.toString()}`;
}

function closeDemoHref(baseId: string, searchParams: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  if (searchParams.date) sp.set("date", searchParams.date);
  if (searchParams.type) sp.set("type", searchParams.type);
  if (searchParams.title) sp.set("title", searchParams.title);
  if (searchParams.equip) sp.set("equip", searchParams.equip);
  if (searchParams.debug) sp.set("debug", searchParams.debug);
  return `/dashboard/seance/${encodeURIComponent(baseId)}?${sp.toString()}`;
}

/* ======================== View ======================== */
const PageView: React.FC<{
  base: AiSession;
  profile: ProfileT | null;
  groups: Record<string, NormalizedExercise[]>;
  plannedMin: number;
  intensity: string;
  coachIntro: string;
  goalLabel?: string;
  dataSource?: string;
  debug?: boolean;
  activeEquip: "full" | "none";
  demoQuery?: string;
  closeDemoHref: string;
  searchParams: Record<string, string | undefined>;
}> = (props) => {
  const { base, profile, groups, demoQuery, closeDemoHref } = props;

  return (
    <div>
      {["echauffement", "principal", "accessoires", "fin"].map((k) => {
        const list = groups[k] || [];
        if (!list.length) return null;
        return (
          <section key={k}>
            <h2>{blockNames[k]}</h2>
            {list.map((ex, i) => {
              const href = openDemoHrefFor(base.id, props.searchParams, ex.name);
              return (
                <a key={`${k}-${i}`} href={href} title={`Voir la démonstration : ${ex.name}`}>
                  {ex.name}
                </a>
              );
            })}
          </section>
        );
      })}

      <DemoModalAI
        open={!!demoQuery}
        onClose={() => (window.location.href = closeDemoHref)}
        exercise={demoQuery || ""}
        level={profile?.level}
        injuries={profile?.injuries}
      />
    </div>
  );
};

/* ======================== Page ======================== */
export default async function Page({ params, searchParams }: {
  params: { id?: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = decodeURIComponent(params?.id ?? "");
  if (!id && !(searchParams?.title || searchParams?.date || searchParams?.type)) {
    redirect("/dashboard/profile?error=Seance%20introuvable");
  }

  const { base, profile, exercises, dataSource, activeEquip } = await loadData(id, searchParams);
  if (!base) redirect("/dashboard/profile?error=Seance%20introuvable");

  const plannedMin = base.plannedMin ?? (profile?.timePerSession ?? 45);
  const intensity = base.intensity ?? "modérée";
  const coachIntro =
    base.type === "muscu"
      ? "Exécution propre, contrôle du tempo et progression des charges."
      : base.type === "cardio"
      ? "Aérobie maîtrisée, souffle régulier en zone 2–3."
      : base.type === "hiit"
      ? "Pics d’intensité courts, technique impeccable."
      : "Mouvement lent et contrôlé, respire profondément.";

  const goalLabel = goalLabelFromProfile(profile);
  const blockOrder = { echauffement: 0, principal: 1, accessoires: 2, fin: 3 } as const;
  const exs = exercises.slice().sort((a, b) => {
    const A = a.block ? (blockOrder as any)[a.block] ?? 99 : 50;
    const B = b.block ? (blockOrder as any)[b.block] ?? 99 : 50;
    return A - B;
  });
  const groups: Record<string, NormalizedExercise[]> = {};
  for (const ex of exs) (groups[ex.block || "principal"] ||= []).push(ex);

  const demoQuery = typeof searchParams?.demo === "string" ? (searchParams!.demo as string) : undefined;
  const safeSP: Record<string, string | undefined> = {
    date: typeof searchParams?.date === "string" ? (searchParams!.date as string) : undefined,
    type: typeof searchParams?.type === "string" ? (searchParams!.type as string) : undefined,
    title: typeof searchParams?.title === "string" ? (searchParams!.title as string) : undefined,
    equip: typeof searchParams?.equip === "string" ? (searchParams!.equip as string) : undefined,
    debug: typeof searchParams?.debug === "string" ? (searchParams!.debug as string) : undefined,
  };
  const closeHref = closeDemoHref(base.id, safeSP);

  return (
    <PageView
      base={base}
      profile={profile}
      groups={groups}
      plannedMin={plannedMin}
      intensity={intensity}
      coachIntro={coachIntro}
      goalLabel={goalLabel}
      dataSource={dataSource}
      debug={false}
      activeEquip={activeEquip}
      demoQuery={demoQuery}
      closeDemoHref={closeHref}
      searchParams={safeSP}
    />
  );
}

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
  const equipParam = String(searchParams?.equip || "").toLowerCase();
  let activeEquip: "full" | "none" = equipParam === "none" ? "none" : "full";
  const store = parseStore(cookies().get("app_sessions")?.value);
  const fromStore = store.sessions.find((s) => s.id === id) as (AiSession & { exercises?: NormalizedExercise[] }) | undefined;

  let aiSessions: AiSession[] = [];
  try {
    const email = await getSignedInEmail();
    aiSessions = email ? await getAiSessions(email) : [];
  } catch {
    aiSessions = [];
  }

  const fromAi = aiSessions.find((s) => s.id === id);
  let base: AiSession | undefined = fromStore || fromAi;

  let profile: ProfileT | null = null;
  try {
    const email = await getSignedInEmail();
    if (email) {
      const answers = await getAnswersForEmail(email);
      if (answers) profile = buildProfileFromAnswers(answers) as ProfileT;
    }
  } catch {}

  if (!equipParam) activeEquip = profile?.equipLevel === "none" ? "none" : "full";

  let exercises: NormalizedExercise[] = fromStore?.exercises || fromAi?.exercises || [];
  if (!exercises.length) exercises = genericFallback((base?.type ?? "muscu") as WorkoutType);

  return { base, profile, exercises, dataSource: "ai", activeEquip };
}
