// app/dashboard/seance/[id]/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** ===== Types ===== */
type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";
type NormalizedExercise = {
  name: string; sets?: number; reps?: string | number; rest?: string;
  durationSec?: number; notes?: string; tempo?: string; rir?: number;
  load?: string; equipment?: string; target?: string; alt?: string;
  videoUrl?: string; block?: "echauffement" | "principal" | "fin" | "accessoires";
};
type Workout = {
  id: string; title: string; type: WorkoutType; status: "active" | "done";
  date: string; plannedMin?: number; startedAt?: string; endedAt?: string;
  note?: string; createdAt: string; exercises?: NormalizedExercise[];
};
type Store = { sessions: Workout[] };

type AiSession = {
  id: string; title: string; type: WorkoutType; date: string;
  plannedMin?: number; note?: string; intensity?: "faible" | "modérée" | "élevée";
  recommendedBy?: string; exercises?: any[]; blocks?: any[]; plan?: any; content?: any;
};
type AiProgramme = { sessions: AiSession[] };

/** ===== Config ===== */
const API_BASE = process.env.FILES_COACHING_API_BASE || "https://files-coaching.com";
const API_KEY  = process.env.FILES_COACHING_API_KEY || "";

/** ===== Utils ===== */
function parseStore(val?: string | null): Store {
  if (!val) return { sessions: [] };
  try { const o = JSON.parse(val!); if (Array.isArray(o?.sessions)) return { sessions: o.sessions as Workout[] }; } catch {}
  return { sessions: [] };
}
function fmtDateYMD(ymd?: string) {
  if (!ymd) return "—";
  try { const [y,m,d] = ymd.split("-").map(Number); const dt = new Date(y,(m||1)-1,d||1);
    return dt.toLocaleDateString("fr-FR",{ year:"numeric", month:"long", day:"numeric" }); } catch { return ymd; }
}
function typeBadgeClass(t: WorkoutType) {
  switch (t) {
    case "muscu": return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "cardio": return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "hiit":  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "mobilité": return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }
}

/** ===== Exos helpers ===== */
function normalizeMaybeArray(v: any): any[] {
  if (!v) return []; if (Array.isArray(v)) return v;
  if (typeof v === "object") {
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.exercises)) return v.exercises;
    if (Array.isArray(v.blocks)) return v.blocks;
  }
  return [];
}
function fromApiExercises(s: AiSession): NormalizedExercise[] | null {
  const candidates: any[] = [
    s.exercises, s.blocks, s.plan?.exercises, s.plan?.blocks,
    s.plan?.day?.exercises, s.plan?.day?.blocks, s.content?.items,
    s.content?.exercises, s.content?.blocks,
  ].flatMap(normalizeMaybeArray);
  if (!candidates.length) return null;

  const out: NormalizedExercise[] = [];
  for (const it of candidates) {
    const name = it?.name || it?.title || it?.exercise || it?.mov || it?.move || it?.movename;
    if (!name) continue;
    const sets = it?.sets ?? it?.series ?? it?.nbSets ?? it?.rounds;
    const reps = it?.reps ?? it?.rep ?? it?.nbReps ?? it?.time ?? it?.duration ?? it?.seconds;
    const rest = it?.rest ?? it?.rest_sec ?? it?.recup ?? it?.pause ?? it?.recovery;
    const notes = it?.notes ?? it?.note ?? it?.tip ?? it?.tips ?? it?.cues;
    const tempo = it?.tempo ?? it?.cadence;
    const rir = typeof it?.rir === "number" ? it.rir : typeof it?.RIR === "number" ? it.RIR : undefined;
    const loadVal = it?.load ?? it?.charge ?? it?.weight ?? it?.kg ?? it?.rpe ?? it?.RPE ?? it?.percent1RM;
    const load = typeof loadVal === "number" ? `${loadVal}kg` : typeof loadVal === "string" ? loadVal : undefined;
    const equipment = it?.equipment ?? it?.materiel ?? it?.matériel;
    const target = it?.target ?? it?.muscles ?? it?.zone ?? it?.focus;
    const alt = it?.alternative ?? it?.alt;
    const videoUrl = it?.videoUrl ?? it?.video ?? it?.url ?? it?.link;
    const blockRaw = (it?.block ?? it?.section ?? it?.phase ?? "").toString().toLowerCase();
    const block: NormalizedExercise["block"] =
      /ech|warm/.test(blockRaw) ? "echauffement" :
      /cool|fin|retour/.test(blockRaw) ? "fin" :
      /acc|accessoire/.test(blockRaw) ? "accessoires" :
      blockRaw ? "principal" : undefined;

    out.push({
      name: String(name),
      sets: typeof sets === "number" ? sets : undefined,
      reps: typeof reps === "number" ? reps : typeof reps === "string" ? reps : undefined,
      rest: typeof rest === "number" ? `${rest}s` : rest,
      durationSec: typeof it?.duration === "number" ? it.duration : typeof it?.seconds === "number" ? it.seconds : undefined,
      notes: typeof notes === "string" ? notes : undefined,
      tempo: typeof tempo === "string" ? tempo : undefined,
      rir, load, equipment: typeof equipment === "string" ? equipment : undefined,
      target: typeof target === "string" ? target : Array.isArray(target) ? target.join(", ") : undefined,
      alt: typeof alt === "string" ? alt : undefined,
      videoUrl: typeof videoUrl === "string" ? videoUrl : undefined,
      block,
    });
  }
  return out.length ? out : null;
}
function fallbackExercises(s: AiSession): NormalizedExercise[] {
  const inten = s.intensity || "modérée";
  const sets = inten === "élevée" ? 4 : inten === "modérée" ? 3 : 2;
  if (s.type === "muscu") {
    return [
      { name: "Squat goblet", sets, reps: "8–12", rest: "60–90s", tempo: "3-1-1", rir: 2, target: "quadriceps, fessiers" },
      { name: "Pompes", sets, reps: "8–12", rest: "60–90s", tempo: "2-1-2", rir: 2, target: "pectoraux, triceps" },
      { name: "Rowing haltère", sets, reps: "10–12", rest: "60–90s", tempo: "2-1-2", rir: 2, target: "dos, biceps" },
      { name: "Fentes marchées", sets, reps: "10 pas/jambe", rest: "60–90s", target: "fessiers, quadriceps" },
      { name: "Gainage planche", sets: sets - 1, reps: "30–45s", rest: "45–60s", target: "core" },
    ];
  }
  if (s.type === "cardio") {
    return [
      { name: "Échauffement facile", sets: 1, reps: "8–10 min", rest: "—", block: "echauffement" },
      { name: "Zone 2 soutenue", sets: 1, reps: `${s.plannedMin ? Math.max(12, s.plannedMin - 15) : 25} min`, rest: "—", block: "principal" },
      { name: "Retour au calme + mobilité", sets: 1, reps: "5–10 min", rest: "—", block: "fin" },
    ];
  }
  if (s.type === "hiit") {
    return [
      { name: "Circuit HIIT (on/off)", sets: 6, reps: "30s/30s", rest: "90s entre sets", block: "principal" },
      { name: "Circuit HIIT (on/off)", sets: 6, reps: "30s/30s", rest: "90s entre sets", block: "principal" },
      { name: "Retour au calme", sets: 1, reps: "5–8 min", rest: "—", block: "fin" },
    ];
  }
  return [
    { name: "Ouverture hanches (90/90)", sets, reps: "8–10/side", rest: "30–45s", block: "echauffement" },
    { name: "T-spine rotations", sets, reps: "8–10/side", rest: "30–45s", block: "echauffement" },
    { name: "Down-Dog → Cobra", sets, reps: "6–8", rest: "30–45s", block: "principal" },
    { name: "Respiration diaphragmatique", sets: 1, reps: "3–4 min", rest: "—", block: "fin" },
  ];
}
function getExercisesFromAi(s: AiSession): NormalizedExercise[] {
  return fromApiExercises(s) ?? fallbackExercises(s);
}

/** ===== Fetch IA ===== */
async function fetchAiProgramme(): Promise<AiProgramme | null> {
  const uidFromCookie = cookies().get("fc_uid")?.value;
  const uid = uidFromCookie || "me";
  const endpoints = [
    `${API_BASE}/api/programme?user=${encodeURIComponent(uid)}`,
    `${API_BASE}/api/program?user=${encodeURIComponent(uid)}`,
    `${API_BASE}/api/sessions?source=ai&user=${encodeURIComponent(uid)}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as any;
      const raw = Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data) ? data : [];
      if (!raw.length) continue;
      return {
        sessions: raw.map((r: any, i: number) => ({
          id: String(r.id ?? `ai-${i}`),
          title: String(r.title ?? r.name ?? "Séance personnalisée"),
          type: (r.type ?? r.category ?? "muscu") as WorkoutType,
          date: String(r.date ?? r.day ?? r.when ?? new Date().toISOString().slice(0, 10)),
          plannedMin: typeof r.plannedMin === "number" ? r.plannedMin : typeof r.duration === "number" ? r.duration : undefined,
          note: typeof r.note === "string" ? r.note : typeof r.notes === "string" ? r.notes : undefined,
          intensity: r.intensity as any,
          recommendedBy: r.recommendedBy ?? r.model ?? "Coach Files",
          exercises: Array.isArray(r.exercises) ? r.exercises : undefined,
          blocks: Array.isArray(r.blocks) ? r.blocks : undefined,
          plan: r.plan, content: r.content,
        }))
      };
    } catch {}
  }
  return null;
}

/** ===== Page détail ===== */
export default async function Page({
  params,
  searchParams
}: {
  params: { id: string },
  searchParams?: Record<string,string | string[] | undefined>
}) {
  const id = decodeURIComponent(params.id);

  // 1) cookies
  const store = parseStore(cookies().get("app_sessions")?.value);
  let saved = store.sessions.find(s => s.id === id);

  // 2) IA par id
  const programme = await fetchAiProgramme();
  const aiById = programme?.sessions.find(s => s.id === id);

  // 3) clé composite via query
  const qpTitle = typeof searchParams?.title === "string" ? searchParams!.title : "";
  const qpDate  = typeof searchParams?.date  === "string" ? searchParams!.date  : "";
  const qpType  = (typeof searchParams?.type  === "string" ? searchParams!.type  : "") as WorkoutType;
  const qpPlannedMin = typeof searchParams?.plannedMin === "string" && searchParams!.plannedMin ? Number(searchParams!.plannedMin) : undefined;

  const key = (t: string, d: string, ty: string) => `${t}|${d}|${ty}`;

  if (!saved && qpTitle && qpDate && qpType) {
    saved = store.sessions.find(s => key(s.title, s.date, s.type) === key(qpTitle, qpDate, qpType));
  }

  let ai = aiById;
  if (!ai && qpTitle && qpDate && qpType && programme) {
    ai = programme.sessions.find(s => key(s.title, s.date, s.type) === key(qpTitle, qpDate, qpType));
  }

  // Construction des données (fallback si rien trouvé)
  let title = "", type: WorkoutType = "muscu", date = "", plannedMin: number | undefined, note: string | undefined;
  let intensity: "faible" | "modérée" | "élevée" | undefined;
  let exercises: NormalizedExercise[] = [];

  if (saved) {
    title = saved.title; type = saved.type; date = saved.date; plannedMin = saved.plannedMin; note = saved.note;
    exercises = Array.isArray(saved.exercises) ? saved.exercises : [];
  } else if (ai) {
    title = ai.title; type = ai.type; date = ai.date; plannedMin = ai.plannedMin; note = ai.note; intensity = ai.intensity;
    exercises = getExercisesFromAi(ai);
  } else if (qpTitle && qpDate && qpType) {
    const fake: AiSession = { id, title: qpTitle, type: qpType, date: qpDate, plannedMin: qpPlannedMin, intensity: "modérée" };
    title = fake.title; type = fake.type; date = fake.date; plannedMin = fake.plannedMin; intensity = fake.intensity;
    exercises = fallbackExercises(fake);
  } else {
    redirect("/dashboard/profile?error=Séance introuvable");
  }

  const blockOrder = { echauffement: 0, principal: 1, accessoires: 2, fin: 3 } as const;
  const exs = exercises.slice().sort((a,b) => {
    const A = a.block ? blockOrder[a.block] ?? 99 : 50;
    const B = b.block ? blockOrder[b.block] ?? 99 : 50;
    return A - B;
  });

  const coachIntro =
    type === "muscu" ? "Objectif : force et qualité d’exécution."
  : type === "cardio" ? "Objectif : endurance aérobie et contrôle du souffle."
  : type === "hiit" ? "Objectif : pics d’intensité courts, récupération active."
  : "Objectif : mobilité et contrôle postural.";
  const coachTips =
    type === "muscu" ? "Garde ~2 reps en réserve sur les dernières séries."
  : type === "cardio" ? "Respiration nasale si possible, finis en respiration contrôlée."
  : type === "hiit" ? "Qualité > quantité. Coupe si la technique se dégrade."
  : "Mouvement lent, fluide, sans douleur — amplitude progressive.";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
        table.prog { width: 100%; border-collapse: collapse; }
        table.prog th, table.prog td { border: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; font-size: 13px; }
        table.prog th { background: #f3f4f6; text-transform: uppercase; letter-spacing: .02em; font-weight: 700; }
      `}</style>

      <div className="page-header no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <a href="/dashboard/profile" className="btn" style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500, padding: "6px 10px" }}>
          ← Retour
        </a>
        {/* Pas d'onClick ici pour éviter les erreurs sur composant serveur */}
        <a href="javascript:print()" className="btn no-print" style={{ background: "#111827", color: "white" }}>
          Imprimer
        </a>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>{title}</h1>
            <div className="text-sm" style={{ color: "#6b7280" }}>
              Prévu le <b style={{ color: "inherit" }}>{fmtDateYMD(date)}</b>
              {plannedMin ? ` · ${plannedMin} min` : ""}
            </div>
          </div>
          <span className={`shrink-0 h-fit inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(type)}`}>
            {type}
          </span>
        </div>

        <div className="text-sm" style={{ marginTop: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          🧭 {coachIntro}
          {"\n"}⏱️ Durée: {plannedMin ? `${plannedMin} min` : "25–45 min"} · Intensité: {intensity || "modérée"}
          {"\n"}💡 Conseils: {coachTips}
        </div>

        {exs.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Détail des exercices</h2>
            <table className="prog">
              <thead>
                <tr>
                  <th>Exercice</th>
                  <th>Séries</th>
                  <th>Rép./Durée</th>
                  <th>Repos</th>
                  <th>Charge</th>
                  <th>Tempo</th>
                  <th>Bloc</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {exs.map((ex, i) => (
                  <tr key={`row-${i}`}>
                    <td>
                      <b>{ex.name}</b>
                      {ex.target ? <div style={{opacity:.7}}>{ex.target}</div> : null}
                      {ex.equipment ? <div style={{opacity:.7}}>Matériel: {ex.equipment}</div> : null}
                      {ex.alt ? <div style={{opacity:.7}}>Alt: {ex.alt}</div> : null}
                      {ex.videoUrl ? <div><a className="underline" href={ex.videoUrl} target="_blank" rel="noreferrer">Vidéo</a></div> : null}
                    </td>
                    <td>{typeof ex.sets === "number" ? ex.sets : "—"}</td>
                    <td>{ex.reps ? String(ex.reps) : (ex.durationSec ? `${ex.durationSec}s` : "—")}</td>
                    <td>{ex.rest || "—"}</td>
                    <td>{ex.load || (typeof ex.rir === "number" ? `RIR ${ex.rir}` : "—")}</td>
                    <td>{ex.tempo || "—"}</td>
                    <td>{ex.block || "—"}</td>
                    <td style={{whiteSpace:"pre-wrap"}}>{ex.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
