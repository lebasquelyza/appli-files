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

/* ======== Titre intelligent : garde le prénom, déduit Haut/Bas si besoin ======== */
function normalize(s?: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
const UPPER_KW = [
  "haut du corps","haut","upper","pector","pecs","poitrine","eapaule","epaules","delto",
  "dos","lats","row","pull","biceps","triceps","tirage","presse a epaules","overhead","ope","push"
];
const LOWER_KW = [
  "bas du corps","bas","lower","jambes","quadriceps","quads","ischio","ischios","fessier","fessiers",
  "mollet","mollets","squat","deadlift","souleve de terre","hip thrust","fente","fentes","split squat",
  "leg press","presse","adducteurs","abducteurs"
];

function scoreSide(text: string) {
  const t = normalize(text);
  let up = 0, low = 0;
  for (const kw of UPPER_KW) if (t.includes(kw)) up++;
  for (const kw of LOWER_KW) if (t.includes(kw)) low++;
  return { up, low };
}

function inferSide(title?: string, exercises?: NormalizedExercise[]): "haut" | "bas" | undefined {
  // 1) Si le titre contient explicitement "haut/bas"
  const t = normalize(title);
  if (/\bhaut\b/.test(t) || t.includes("haut du corps")) return "haut";
  if (/\bbas\b/.test(t) || t.includes("bas du corps")) return "bas";

  // 2) Sinon: scoring sur le titre
  const s1 = scoreSide(title || "");
  // 3) Et sur les exos (name + target)
  let up = s1.up, low = s1.low;
  for (const ex of exercises || []) {
    const parts = [ex.name, ex.target].filter(Boolean).join(" ");
    const s = scoreSide(parts);
    up += s.up;
    low += s.low;
  }
  if (up === 0 && low === 0) return undefined;
  return up >= low ? "haut" : "bas";
}

/** Construit le libellé final : “Séance pour {Prénom} — Haut/Bas du corps” (ou “Séance” si indécidable) */
function sessionTitleSmart(raw?: string, exercises?: NormalizedExercise[], opts: { keepName?: boolean } = { keepName: true }) {
  const s = String(raw || "");
  const name = (s.match(/S[ée]ance\s+pour\s+([^—–-]+)/i)?.[1] || "").trim();
  // retire le préfixe “Séance pour XXX — …”
  let t = s.replace(/S[ée]ance\s+pour\s+[^—–-]+[—–-]\s*/i, "");
  // retire la lettre/plan "— A" / "· A"
  t = t.replace(/[—–-]\s*[A-Z]\b/g, "").replace(/·\s*[A-Z]\b/g, "");

  const side = inferSide(t, exercises);
  const sideLabel = side === "haut" ? "Haut du corps" : side === "bas" ? "Bas du corps" : "Séance";

  return opts.keepName && name ? `Séance pour ${name} — ${sideLabel}` : sideLabel;
}

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
  .btn-ghost { background:#fff; color:#111827; }
  @media print { .no-print { display: none !important; } }
`;

/* ====================== Data Loader (IA + fallback) ====================== */
async function loadData(
  id: string,
  searchParams?: Record<string, string | string[] | undefined>
): Promise<{
  base?: AiSession;
  exercises: NormalizedExercise[];
}> {
  const equipParam = String(searchParams?.equip || "").toLowerCase();
  let base: AiSession | undefined;
  let exercises: NormalizedExercise[] = [];

  // 1) Régénère via IA depuis Google Sheet (source de vérité)
  try {
    const email = await getSignedInEmail();
    if (email) {
      const answers = await getAnswersForEmail(email);
      if (answers) {
        if (equipParam === "none") (answers as any).equipLevel = "none";
        if (equipParam === "full") (answers as any).equipLevel = "full";

        const regenProg = generateProgrammeFromAnswers(answers); // 🧠 IA ici
        const regen = regenProg.sessions || [];
        base = regen.find((s) => s.id === id) || regen[0];

        if (base?.exercises?.length) exercises = base.exercises!;
      }
    }
  } catch {}

  // 2) Filet si rien trouvé
  if (!base) {
    base = { id, title: "Séance personnalisée", date: "", type: "muscu", plannedMin: 45 } as AiSession;
  }
  if (!exercises.length) {
    exercises = genericFallback((base?.type ?? "muscu") as WorkoutType);
  }

  return { base, exercises };
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

/* ======================== View (JSX) ======================== */
const PageView: React.FC<{
  base: AiSession;
  groups: Record<string, NormalizedExercise[]>;
  plannedMin: number;
  exercises: NormalizedExercise[];
}> = ({ base, groups, plannedMin, exercises }) => {
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="mb-2 flex items-center justify-between no-print" style={{ paddingInline: 12 }}>
        <a href="/dashboard/profile" className="btn btn-ghost" style={{ borderColor:"#e5e7eb", padding: "6px 10px", borderRadius: 8 }}>
          ← Retour
        </a>
        <div className="text-xs text-gray-400">Programme IA</div>
      </div>

      <div className="mx-auto w-full" style={{ maxWidth: 640, paddingInline: 12, paddingBottom: 24 }}>
        <div className="page-header">
          <div>
            <h1 className="h1-compact">{sessionTitleSmart(base.title, exercises, { keepName: true })}</h1>
            {/* pas de date, juste type + durée */}
            <p className="lead-compact">
              {plannedMin} min · {base.type}
            </p>
          </div>
        </div>

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
                  const reps = cleanText(ex.reps ? String(ex.reps) : ex.durationSec ? `${ex.durationSec}s` : "");
                  const rest = cleanText(ex.rest || "");
                  return (
                    <article key={`${k}-${i}`} className="compact-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="exoname">{ex.name}</div>
                        {/* ✅ badge à droite supprimé */}
                      </div>

                      {/* puces — uniquement Séries / Rép. / Repos */}
                      <div className="chips">
                        {typeof ex.sets === "number" && (
                          <Chip label="🧱" value={`${ex.sets} séries`} title="Séries" />
                        )}
                        {reps && <Chip label="🔁" value={reps} title="Rép./Durée" />}
                        {rest && <Chip label="⏲️" value={rest} title="Repos" />}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
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

  const { base, exercises } = await loadData(id, searchParams);
  if (!base) redirect("/dashboard/profile?error=Seance%20introuvable");

  const plannedMin = base.plannedMin ?? 45;

  // tri + groupage par bloc (comme avant)
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

  return (
    <PageView
      base={base}
      groups={groups}
      plannedMin={plannedMin}
      exercises={exercises}
    />
  );
}
