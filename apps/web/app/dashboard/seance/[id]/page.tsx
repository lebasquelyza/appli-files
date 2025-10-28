import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NextDynamic from "next/dynamic"; // ⬅️ renommé pour éviter le conflit
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
const DemoModalAI = NextDynamic(() => import("../../../components/DemoModalAI"), { ssr: false });

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
  // variantes possibles côté questionnaire
  goal?: string;
  primaryGoal?: string;
  objective?: string;
  mainObjective?: string;
  currentGoal?: string;
};

export const dynamic = "force-dynamic"; // ⬅️ Next.js app router flag (OK maintenant)

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
  .meta-row { font-size:12.5px; color:#6b7280; margin-top:6px; display:grid; gap:4px; grid-template-columns:1fr; }
  .btn { display:inline-flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid #e5e7eb; background:#111827; color:#fff; font-weight:700; padding:8px 12px; line-height:1.2; }
  .btn:hover { background:#0b1220; }
  .btn-ghost { background:#fff; color:#111827; }
  .btn-ghost:hover { background:#f9fafb; }
  .btn-sm { padding:6px 10px; border-radius:8px; font-weight:600; font-size:12.5px; }
  .btn-row { display:flex; gap:8px; flex-wrap:wrap; }
  .card-link { text-decoration:none; color:inherit; display:block; }
  .card-link:hover .compact-card { border-color:#111827; box-shadow:0 1px 0 rgba(17,24,39,.08); }
  @media(min-width:640px){ .meta-row{ grid-template-columns:1fr 1fr; } }
  @media print { .no-print { display: none !important; } }
`;

/* ======================== Goal label helper (aligné sur la page profil) ======================== */
function goalLabelFromProfile(profile: any): string | undefined {
  if (!profile) return undefined;

  // 1) Priorité au libellé brut du Sheet (comme dans "Mes infos")
  const raw = String(profile?.objectif ?? "").trim();
  if (raw) return raw;

  // 2) Sinon fallback via la clé normalisée -> libellé FR
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

/* ======================== Types ======================== */
type PageViewProps = {
  base: AiSession;
  profile: ProfileT | null;
  groups: Record<string, NormalizedExercise[]>;
  plannedMin: number;
  intensity: string;
  coachIntro: string;
  goalLabel?: string;
  dataSource?: string;
  debug?: boolean;
  /** full = avec équipement, none = sans équipement */
  activeEquip: "full" | "none";
  /** optional demo query from searchParams */
  demoQuery?: string;
  /** URL to close the modal (current page without demo) */
  closeDemoHref: string;
};

/* Build href to open demo for a given exercise (server-side, no client state) */
function openDemoHrefFor(baseId: string, searchParams: Record<string,string|undefined>, name: string) {
  const sp = new URLSearchParams();
  // keep known params
  if (searchParams.date) sp.set("date", searchParams.date);
  if (searchParams.type) sp.set("type", searchParams.type);
  if (searchParams.title) sp.set("title", searchParams.title);
  if (searchParams.equip) sp.set("equip", searchParams.equip);
  if (searchParams.debug) sp.set("debug", searchParams.debug);
  sp.set("demo", name);
  return `/dashboard/seance/${encodeURIComponent(baseId)}?${sp.toString()}`;
}

/* Build a close href (remove demo param) */
function closeDemoHref(baseId: string, searchParams: Record<string,string|undefined>) {
  const sp = new URLSearchParams();
  if (searchParams.date) sp.set("date", searchParams.date);
  if (searchParams.type) sp.set("type", searchParams.type);
  if (searchParams.title) sp.set("title", searchParams.title);
  if (searchParams.equip) sp.set("equip", searchParams.equip);
  if (searchParams.debug) sp.set("debug", searchParams.debug);
  return `/dashboard/seance/${encodeURIComponent(baseId)}?${sp.toString()}`;
}

/* ======================== View (JSX) ======================== */
const PageView: React.FC<PageViewProps & {
  searchParams: Record<string,string|undefined>;
}> = (props) => {
  const {
    base,
    profile,
    groups,
    plannedMin,
    intensity,
    coachIntro,
    goalLabel,
    dataSource,
    debug,
    activeEquip,
    demoQuery,
    closeDemoHref,
    searchParams,
  } = props;

  // Build equip toggle URLs (simple: keep same id and force regen with equip)
  const withEquipHref = `/dashboard/seance/${encodeURIComponent(base.id)}?regen=1&equip=full`;
  const noEquipHref = `/dashboard/seance/${encodeURIComponent(base.id)}?regen=1&equip=none`;

  const filled = "btn btn-sm";
  const ghost = "btn btn-sm btn-ghost";

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {/* top bar */}
      <div className="mb-2 flex items-center justify-between no-print" style={{ paddingInline: 12 }}>
        {/* Bouton retour — plus petit et reste en haut */}
        <a
          href="/dashboard/profile"
          className="btn btn-sm btn-ghost"
          style={{ borderColor:"#e5e7eb" }}
        >
          ← Retour
        </a>
        <div className="flex items-center gap-2">
          {debug && dataSource && (
            <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Source: {dataSource}
            </span>
          )}
        </div>
      </div>

      {/* wrapper étroit pour mobile */}
      <div className="mx-auto w-full" style={{ maxWidth: 640, paddingInline: 12, paddingBottom: 24 }}>
        {/* header */}
        <div className="page-header">
          <div>
            <h1 className="h1-compact">{base.title}</h1>
            <p className="lead-compact">
              {fmtDateYMD(base.date)} · {plannedMin} min · {base.type}
            </p>
          </div>
        </div>

        {/* Brief */}
        <section className="section" style={{ marginTop: 12 }}>
          <div className="section-head" style={{ marginBottom: 8 }}>
            <h2 className="section-title">Brief de séance</h2>
          </div>
          <div className="compact-card">
            {/* Objectif actuel du client — libellé FR conforme à la page profil */}
            {goalLabel && (
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                🎯 <b>Objectif actuel</b> : {goalLabel}
              </div>
            )}
            <ul style={{ fontSize: 14, lineHeight: 1.5 }}>
              <li>
                🧭 <b>Intention de séance</b> : {coachIntro}
              </li>
              <li>
                ⏱️ <b>Durée</b> : {plannedMin} min · <b>Intensité</b> : {intensity}
              </li>
              {profile?.equipLevel && (
                <li>
                  🧰 <b>Matériel</b> :{" "}
                  {profile.equipLevel === "full"
                    ? "accès salle (machines/barres)"
                    : profile.equipLevel === "limited"
                    ? `limité (${profile.equipItems?.join(", ") || "quelques charges"})`
                    : "aucun (poids du corps)"}
                </li>
              )}
              {profile?.injuries?.length ? (
                <li style={{ color: "#92400e" }}>
                  ⚠️ <b>Prudence</b> : {profile.injuries.join(", ")}
                </li>
              ) : null}
              <li>
                💡 <b>Conseils</b> :{" "}
                {base.type === "muscu"
                  ? "Laisse 1–2 reps en réserve sur la dernière série."
                  : base.type === "cardio"
                  ? "Reste en Z2 : tu dois pouvoir parler en phrases courtes."
                  : base.type === "hiit"
                  ? "Coupe une série si la technique se dégrade."
                  : "Mouvement lent et contrôlé, respire profondément."}
              </li>
            </ul>
          </div>

          {/* Boutons variantes équipement — avec état visuel sélectionné */}
          <div className="no-print" style={{ marginTop: 10 }}>
            <div className="btn-row">
              <a
                href={withEquipHref}
                aria-pressed={activeEquip === "full"}
                className={activeEquip === "full" ? filled : ghost}
                title="Variante avec matériel (salle/charges)"
              >
                Avec équipement
              </a>
              <a
                href={noEquipHref}
                aria-pressed={activeEquip === "none"}
                className={activeEquip === "none" ? filled : ghost}
                title="Variante sans équipement (poids du corps)"
              >
                Sans équipement
              </a>
            </div>
          </div>
        </section>

        {/* Blocs */}
        {["echauffement", "principal", "accessoires", "fin"].map((k) => {
          const list = groups[k] || [];
          if (!list.length) return null;
          return (
            <section key={k} className="section" style={{ marginTop: 12 }}>
              <div className="section-head" style={{ marginBottom: 8 }}>
                <h2 className="section-title">{blockNames[k]}</h2>
              </div>

              <div className="grid gap-3">
                {list.map((ex, i) => {
                  const reps = ex.reps ? String(ex.reps) : ex.durationSec ? `${ex.durationSec}s` : "";
                  const loadStr =
                    ex.load !== undefined && ex.load !== null
                      ? String(ex.load)
                      : (typeof ex.rir === "number" ? `RIR ${ex.rir}` : "");
                  const href = openDemoHrefFor(base.id, searchParams, ex.name);
                  return (
                    <a
                      key={`${k}-${i}`}
                      href={href}
                      className="card-link"
                      title={`Voir la démonstration : ${ex.name}`}
                    >
                      <article className="compact-card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="exoname">{ex.name}</div>
                          {ex.block ? (
                            <span className="shrink-0 rounded-full bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
                              {blockNames[ex.block] || ex.block}
                            </span>
                          ) : null}
                        </div>

                        {/* chips compactes */}
                        <div className="chips">
                          <span title="Séries" className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] leading-[14px] text-neutral-800">
                            <span className="mr-1 opacity-70">🧱</span> {typeof ex.sets === "number" ? `${ex.sets} séries` : "—"}
                          </span>
                          <span title="Rép./Durée" className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] leading-[14px] text-neutral-800">
                            <span className="mr-1 opacity-70">🔁</span> {reps || "—"}
                          </span>
                          <span title="Repos" className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] leading-[14px] text-neutral-800">
                            <span className="mr-1 opacity-70">⏲️</span> {ex.rest || "—"}
                          </span>
                          <span title="Charge / RIR" className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] leading-[14px] text-neutral-800">
                            <span className="mr-1 opacity-70">🏋︎</span> {loadStr || "—"}
                          </span>
                          {ex.tempo && (
                            <span title="Tempo" className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] leading-[14px] text-neutral-800">
                              <span className="mr-1 opacity-70">🎚</span> {ex.tempo}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[12px] text-neutral-800">🤖 Démo IA</span>
                        </div>

                        {(ex.target || ex.equipment || ex.alt || ex.notes) && (
                          <div className="meta-row">
                            {ex.target && <div>🎯 {ex.target}</div>}
                            {ex.equipment && <div>🧰 {ex.equipment}</div>}
                            {ex.alt && <div>🔁 Alt: {ex.alt}</div>}
                            {ex.notes && <div>📝 {ex.notes}</div>}
                          </div>
                        )}
                      </article>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Modal DEMO IA (ChatGPT) */}
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

  // NEW: lire param d'URL equip et initialiser l'état actif
  const equipParam = String(searchParams?.equip || "").toLowerCase();
  let activeEquip: "full" | "none" = equipParam === "none" ? "none" : "full";

  const store = parseStore(cookies().get("app_sessions")?.value);
  const fromStore = store.sessions.find((s) => s.id === id) as
    | (AiSession & { exercises?: NormalizedExercise[] })
    | undefined;

  // ⬇️ lire les séances IA via la lib (email depuis cookie/app session)
  let aiSessions: AiSession[] = [];
  try {
    const email = await getSignedInEmail();
    aiSessions = email ? await getAiSessions(email) : [];
  } catch (e) {
    console.warn("getAiSessions failed", e);
    aiSessions = [];
  }
  const fromAi = aiSessions.find((s) => s.id === id);

  const qpTitle = typeof searchParams?.title === "string" ? (searchParams!.title as string) : "";
  const qpDateRaw = typeof searchParams?.date === "string" ? (searchParams!.date as string) : "";
  const qpType = normalizeWorkoutType(
    typeof searchParams?.type === "string" ? (searchParams!.type as string) : ""
  );
  const qpPlannedMin =
    typeof searchParams?.plannedMin === "string" && searchParams!.plannedMin
      ? Number(searchParams!.plannedMin)
      : undefined;

  const today = new Date();
  const qpDate =
    qpDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(qpDateRaw)
      ? qpDateRaw
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
          today.getDate()
        ).padStart(2, "0")}`;

  const key = (t: string, d: string, ty: string) => `${t}|${d}|${ty}`;
  const storeByQD =
    !fromStore && qpTitle
      ? store.sessions.find((s) => key(s.title, s.date, s.type) === key(qpTitle, qpDate, qpType))
      : undefined;
  const aiByQD =
    !fromAi && qpTitle && aiSessions.length
      ? aiSessions.find((s) => key(s.title, s.date, s.type) === key(qpTitle, qpDate, qpType))
      : undefined;

  let dataSource = "unknown";

  // Base prioritaire par id / query
  let base: AiSession | undefined =
    (fromStore as AiSession | undefined) || fromAi || (storeByQD as AiSession | undefined) || aiByQD;

  if (fromStore) dataSource = "store";
  else if (fromAi) dataSource = "ai";
  else if (storeByQD) dataSource = "storeByQD";
  else if (aiByQD) dataSource = "aiByQD";

  // Force regeneration if requested
  if (forceRegen) {
    dataSource = "regen";
    base =
      base ||
      ({
        id: "stub",
        title: qpTitle || "Séance personnalisée",
        date: qpDate,
        type: qpType,
        plannedMin: qpPlannedMin,
      } as AiSession);
  }

  // Si rien de trouvé mais des QPs => stub minimal
  if (!base && (qpTitle || qpDateRaw || (searchParams?.type as string | undefined))) {
    dataSource = "stub";
    base = {
      id: "stub",
      title: qpTitle || "Séance personnalisée",
      date: qpDate,
      type: qpType,
      plannedMin: qpPlannedMin,
    } as AiSession;
  }

  // Profile depuis les réponses
  let profile: ProfileT | null = null;
  try {
    const email = await getSignedInEmail();
    if (email) {
      const answers = await getAnswersForEmail(email);
      if (answers) profile = buildProfileFromAnswers(answers) as ProfileT;
    }
  } catch (e) {
    console.warn("build profile failed", e);
  }

  // Si pas de param d’URL, déduire depuis le profil (none => bouton "Sans équipement" actif)
  if (!equipParam) {
    activeEquip = profile?.equipLevel === "none" ? "none" : "full";
  }

  // Exercices
  let exercises: NormalizedExercise[] =
    (fromStore?.exercises as NormalizedExercise[] | undefined) ||
    (fromAi?.exercises as NormalizedExercise[] | undefined) ||
    [];

  // Régénération si demandée OU si on n'a rien
  if (forceRegen || !exercises.length) {
    try {
      const email = await getSignedInEmail();
      if (email) {
        const answers = await getAnswersForEmail(email);
        if (answers) {
          // Equip override via query ?equip=full|none
          const eq = equipParam === "none" ? "none" : equipParam === "full" ? "full" : "";
          if (eq) (answers as any).equipLevel = eq;

          const regenProg = generateProgrammeFromAnswers(answers); // { sessions }
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

  if (debug) {
    console.log("seance page dataSource=", dataSource, {
      id,
      foundStore: !!fromStore,
      foundAi: !!fromAi,
      storeLen: store.sessions.length,
      programmeLen: aiSessions.length,
      activeEquip,
    });
  }

  return { base, profile, exercises, dataSource, activeEquip };
}

/* ======================== Small UI ======================== */
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

/* ======================== Page (server) ======================== */
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
      : "Amplitude confortable, respiration calme, zéro douleur nette.";

  // Objectif actuel du client — libellé FR identique au profil
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

  const debug = String(searchParams?.debug || "") === "1";

  const demoQuery = typeof searchParams?.demo === "string" ? (searchParams!.demo as string) : undefined;
  const safeSP: Record<string,string|undefined> = {
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
      debug={debug}
      activeEquip={activeEquip}
      demoQuery={demoQuery}
      closeDemoHref={closeHref}
      searchParams={safeSP}
    />
  );
}

