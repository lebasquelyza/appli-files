import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ===================== Types ===================== */
type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";
type WorkoutStatus = "active" | "done";

type NormalizedExercise = {
  name: string;
  sets?: number;
  reps?: string | number;
  rest?: string;
  durationSec?: number;
  notes?: string;

  // champs avancés
  tempo?: string;          // ex: "3-1-1"
  rir?: number;            // reps in reserve
  load?: string;           // ex: "20kg", "RPE 8", "75% 1RM"
  equipment?: string;      // ex: "haltères, banc"
  target?: string;         // ex: "pectoraux, triceps"
  alt?: string;            // alternative si pas de matériel
  videoUrl?: string;       // lien demo
  block?: "echauffement" | "principal" | "fin" | "accessoires";
};

type Workout = {
  id: string;
  title: string;
  type: WorkoutType;
  status: WorkoutStatus;
  date: string;        // YYYY-MM-DD (prévu)
  plannedMin?: number; // durée prévue
  startedAt?: string;  // ISO quand démarrée
  endedAt?: string;    // ISO quand terminée
  note?: string;
  createdAt: string;   // ISO
  exercises?: NormalizedExercise[]; // détails persistés si dispo
};

type Store = { sessions: Workout[] };

type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string;          // YYYY-MM-DD
  plannedMin?: number;
  note?: string;
  intensity?: "faible" | "modérée" | "élevée";
  recommendedBy?: string;
  exercises?: any[];
  blocks?: any[];
  plan?: any;
  content?: any;
};
type AiProgramme = { sessions: AiSession[] };

/* ===================== Config ===================== */
const API_BASE = process.env.FILES_COACHING_API_BASE || "https://files-coaching.com";
const API_KEY  = process.env.FILES_COACHING_API_KEY || "";

// Google Sheets (public via lien)
const SHEET_ID      = process.env.SHEET_ID      || "1XH-BOUj4tXAVy49ONBIdLiWM97hQ-Fg8h5-OTRGvHC4";
const SHEET_RANGE   = process.env.SHEET_RANGE   || "Réponses!A1:K";
const SHEET_GID     = process.env.SHEET_GID     || "1160551014";

// Questionnaire (pour le lien dans l’état vide)
const QUESTIONNAIRE_BASE = process.env.FILES_COACHING_QUESTIONNAIRE_BASE || "https://questionnaire.files-coaching.com";

/* ===================== Détection e-mail (auth) ===================== */
async function getSignedInEmail(): Promise<string> {
  try {
    // @ts-ignore import optionnel
    const { getServerSession } = await import("next-auth");
    // @ts-ignore adapte ce chemin si besoin
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions as any);
    const email = (session as any)?.user?.email as string | undefined;
    if (email) return email;
  } catch {}
  return cookies().get("app_email")?.value || "";
}

/* ============ Fetch du programme IA (Coach Files) ============ */
async function fetchAiProgramme(userId?: string): Promise<AiProgramme | null> {
  const uidFromCookie = cookies().get("fc_uid")?.value;
  const uid = userId || uidFromCookie || "me";

  const endpoints = [
    `${API_BASE}/api/programme?user=${encodeURIComponent(uid)}`,
    `${API_BASE}/api/program?user=${encodeURIComponent(uid)}`,
    `${API_BASE}/api/sessions?source=ai&user=${encodeURIComponent(uid)}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        },
        cache: "no-store",
      });
      if (!res.ok) continue;

      const data = (await res.json()) as any;
      const raw = Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data) ? data : [];
      if (!raw.length) continue;

      const sessions: AiSession[] = raw.map((r: any, i: number) => ({
        id: String(r.id ?? `ai-${i}`),
        title: String(r.title ?? r.name ?? "Séance personnalisée"),
        type: (r.type ?? r.category ?? "muscu") as WorkoutType,
        date: String(r.date ?? r.day ?? r.when ?? new Date().toISOString().slice(0, 10)),
        plannedMin:
          typeof r.plannedMin === "number"
            ? r.plannedMin
            : typeof r.duration === "number"
            ? r.duration
            : undefined,
        note: typeof r.note === "string" ? r.note : typeof r.notes === "string" ? r.notes : undefined,
        intensity: r.intensity as any,
        recommendedBy: r.recommendedBy ?? r.model ?? "Coach Files",
        exercises: Array.isArray(r.exercises) ? r.exercises : undefined,
        blocks: Array.isArray(r.blocks) ? r.blocks : undefined,
        plan: r.plan,
        content: r.content,
      }));
      return { sessions };
    } catch (e: any) {
      if (isNextRedirect(e)) throw e;
    }
  }

  // Pas de données API : on affiche (sans persister) un fallback local basé sur la dernière réponse
  try {
    const email = (await getSignedInEmail()) || cookies().get("app_email")?.value || "";
    if (email) {
      const ans = await getAnswersForEmail(email, SHEET_ID, SHEET_RANGE);
      if (ans) return { sessions: generateSessionsFromAnswers(ans) };
    }
  } catch {}
  return null;
}

/* ===================== Utils ===================== */
function parseStore(val?: string | null): Store {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as Workout[] };
  } catch {}
  return { sessions: [] };
}
function uid() { return "id-" + Math.random().toString(36).slice(2, 10); }
function toYMD(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function fmtDateISO(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("fr-FR", { year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" });
    }
  } catch {}
  return iso || "—";
}
function fmtDateYMD(ymd?: string) {
  if (!ymd) return "—";
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("fr-FR", { year:"numeric", month:"long", day:"numeric" });
  } catch {}
  return ymd;
}
function minutesBetween(a?: string, b?: string) {
  if (!a || !b) return undefined;
  const A = new Date(a).getTime(), B = new Date(b).getTime();
  if (!isFinite(A) || !isFinite(B)) return undefined;
  const mins = Math.round((B - A) / 60000);
  return mins >= 0 ? mins : undefined;
}
function typeBadgeClass(t: WorkoutType) {
  switch (t) {
    case "muscu": return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "cardio": return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "hiit":  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "mobilité": return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }
}
function uniqueBy<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (!seen.has(k)) { seen.add(k); out.push(item); }
  }
  return out;
}
function clampOffset(total: number, take: number, offset: number) {
  if (total <= 0) return { offset: 0, emptyReason: "none" as const };
  if (offset >= total) return { offset: Math.max(0, Math.ceil(total / take) * take - take), emptyReason: "ranout" as const };
  return { offset, emptyReason: "none" as const };
}

/* ======== Google Sheets (PUBLIC via lien) ======== */
async function fetchValues(sheetId: string, range: string) {
  const sheetName = (range.split("!")[0] || "").replace(/^'+|'+$/g, "");
  if (!sheetId) throw new Error("SHEETS_CONFIG_MISSING");

  const tries: string[] = [];

  if (SHEET_GID) {
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=${encodeURIComponent(SHEET_GID)}`);
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(SHEET_GID)}`);
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${encodeURIComponent(SHEET_GID)}`);
  }
  if (sheetName) {
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);
  }

  for (const url of tries) {
    const res = await fetch(url, { cache: "no-store" });
    const lastCT = res.headers.get("content-type") || "";
    const text = await res.text().catch(() => "");

    if (res.ok) {
      const looksHtml = text.trim().startsWith("<") || lastCT.includes("text/html");
      if (looksHtml) continue;

      const rows: string[][] = [];
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      for (const line of lines) {
        const cells: string[] = [];
        let cur = "", inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (ch === "," && !inQuotes) {
            cells.push(cur.trim()); cur = "";
          } else {
            cur += ch;
          }
        }
        cells.push(cur.trim());
        rows.push(cells.map(c => c.replace(/^"|"$/g, "")));
      }
      return { values: rows };
    }
  }
  throw new Error("SHEETS_FETCH_FAILED");
}

/* ======== Normalisation (questionnaire) ======== */
type Answers = Record<string, string>;
function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[éèêë]/g, "e")
    .replace(/[àâä]/g, "a")
    .replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o")
    .replace(/[ùûü]/g, "u")
    .replace(/[’']/g, "'");
}

/* ===================== Aide: détection redirect Next ===================== */
function isNextRedirect(e: any) {
  try {
    const d = (e as any)?.digest;
    return typeof d === "string" && d.startsWith("NEXT_REDIRECT");
  } catch { return false; }
}

/* ===================== Coach text & exercices ===================== */
function coachText(s: AiSession) {
  const min = s.plannedMin ? `${s.plannedMin} min` : "25–45 min";
  const intens = s.intensity ? s.intensity : "modérée";
  const intro =
    s.type === "muscu" ? "Objectif : force et qualité d’exécution."
  : s.type === "cardio" ? "Objectif : endurance aérobie et contrôle du souffle."
  : s.type === "hiit" ? "Objectif : pics d’intensité courts, récupération active."
  : "Objectif : mobilité et contrôle postural.";
  const tips =
    s.type === "muscu" ? "Garde ~2 reps en réserve sur les dernières séries."
  : s.type === "cardio" ? "Respiration nasale si possible, finis en respiration contrôlée."
  : s.type === "hiit" ? "Qualité > quantité. Coupe si la technique se dégrade."
  : "Mouvement lent, fluide, sans douleur — amplitude progressive.";
  return `🧭 ${intro}\n⏱️ Durée: ${min} · Intensité: ${intens}\n💡 Conseils: ${tips}${s.note ? `\n📝 Note: ${s.note}` : ""}`;
}

function normalizeMaybeArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "object") {
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.exercises)) return v.exercises;
    if (Array.isArray(v.blocks)) return v.blocks;
  }
  return [];
}

/* ======== Mapping IA → exercices détaillés ======== */
function fromApiExercises(s: AiSession): NormalizedExercise[] | null {
  const candidates: any[] = [
    s.exercises,
    s.blocks,
    s.plan?.exercises,
    s.plan?.blocks,
    s.plan?.day?.exercises,
    s.plan?.day?.blocks,
    s.content?.items,
    s.content?.exercises,
    s.content?.blocks,
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

    // champs avancés
    const tempo = it?.tempo ?? it?.cadence;
    const rir = typeof it?.rir === "number" ? it.rir
              : typeof it?.RIR === "number" ? it.RIR
              : undefined;
    const loadVal = it?.load ?? it?.charge ?? it?.weight ?? it?.kg ?? it?.rpe ?? it?.RPE ?? it?.percent1RM;
    const load =
      typeof loadVal === "number" ? `${loadVal}kg` :
      typeof loadVal === "string" ? loadVal :
      undefined;
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
      rir,
      load,
      equipment: typeof equipment === "string" ? equipment : undefined,
      target: typeof target === "string" ? target : Array.isArray(target) ? target.join(", ") : undefined,
      alt: typeof alt === "string" ? alt : undefined,
      videoUrl: typeof videoUrl === "string" ? videoUrl : undefined,
      block,
    });
  }

  return out.length ? out : null;
}

/* ======== Fallback local si pas d'IA ======== */
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
function getExercises(s: AiSession): NormalizedExercise[] {
  return fromApiExercises(s) ?? fallbackExercises(s);
}

/* ===================== Actions serveur ===================== */
async function buildProgrammeAction() {
  "use server";
  const jar = cookies();
  let email = await getSignedInEmail();
  if (!email) email = jar.get("app_email")?.value || "";
  if (email) {
    jar.set("app_email", email, { path: "/", sameSite: "lax", maxAge: 60*60*24*365, httpOnly: false });
  }

  // Récupère la DERNIÈRE réponse de questionnaire
  let answers: Answers | null = null;
  try { if (email) answers = await getAnswersForEmail(email, SHEET_ID, SHEET_RANGE); } catch {}

  const uid = jar.get("fc_uid")?.value || "me";

  // Brief IA pour forcer un programme ultra-détaillé
  const aiBrief = {
    language: "fr",
    detailLevel: "full",
    require: [
      "échauffement structuré (5–10 min)",
      "bloc principal par exercices avec séries, répétitions OU durée, tempo, repos",
      "charge cible (kg, %, ou RPE), ou RIR",
      "matériel requis et alternative sans matériel si possible",
      "groupes musculaires ciblés",
      "lien vidéo de démonstration si disponible",
      "retour au calme / mobilité (5–10 min)",
    ],
    style: {
      tempoFormat: "ex: 3-1-1",
      loadFormat: "ex: 20kg ou RPE 8 ou 75%1RM",
      repsFormat: "ex: 8–12 ou 30s/30s",
      restFormat: "ex: 60–90s",
    },
    outputSchemaHint: {
      sessions: [
        {
          id: "string",
          title: "string",
          type: "muscu|cardio|hiit|mobilité",
          date: "YYYY-MM-DD",
          plannedMin: "number",
          intensity: "faible|modérée|élevée",
          exercises: [
            {
              name: "string",
              sets: "number",
              reps: "string|number",
              rest: "string",
              tempo: "string",
              rir: "number",
              load: "string",
              equipment: "string",
              target: "string|string[]",
              alt: "string",
              videoUrl: "string",
              block: "echauffement|principal|fin|accessoires",
              notes: "string"
            }
          ]
        }
      ]
    }
  };

  const payload = { user: uid, source: "app-profile", email, answers, aiBrief };

  const endpoints = [
    `${API_BASE}/api/programme/build`,
    `${API_BASE}/api/program/build`,
    `${API_BASE}/api/sessions/build`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (res.ok) redirect("/dashboard/profile?success=programme");
    } catch (e: any) {
      if (isNextRedirect(e)) throw e;
    }
  }

  redirect("/dashboard/profile?error=Aucune donnée reçue de l’IA. Les propositions locales sont affichées sans enregistrement.");
}

async function addSessionAction(formData: FormData) {
  "use server";
  const title = (formData.get("title") || "").toString().trim();
  const type = (formData.get("type") || "muscu").toString() as WorkoutType;
  const date = (formData.get("date") || toYMD()).toString();
  const plannedMinStr = (formData.get("plannedMin") || "").toString().replace(",", ".");
  const note = (formData.get("note") || "").toString().slice(0, 240);
  const startNow = (formData.get("startNow") || "").toString() === "1";

  if (!title) redirect("/dashboard/profile?error=titre");

  const store = parseStore(cookies().get("app_sessions")?.value);

  const w: Workout = {
    id: uid(),
    title,
    type: (["muscu", "cardio", "hiit", "mobilité"].includes(type) ? type : "muscu") as WorkoutType,
    status: "active",
    date,
    plannedMin: plannedMinStr ? Number(plannedMinStr) : undefined,
    startedAt: startNow ? new Date().toISOString() : undefined,
    note: note || undefined,
    createdAt: new Date().toISOString(),
  };

  const next: Store = { sessions: [w, ...store.sessions].slice(0, 300) };

  cookies().set("app_sessions", JSON.stringify(next), {
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  });

  redirect("/dashboard/profile?success=1");
}

async function saveSingleAiSessionAction(formData: FormData) {
  "use server";
  const id = (formData.get("id") || "").toString();
  const title = (formData.get("title") || "").toString().trim();
  const type = (formData.get("type") || "muscu").toString() as WorkoutType;
  const date = (formData.get("date") || toYMD()).toString();
  const plannedMinStr = (formData.get("plannedMin") || "").toString().replace(",", ".");
  const note = (formData.get("note") || "").toString();
  const exercisesJson = (formData.get("exercises") || "").toString();

  if (!title) redirect("/dashboard/profile?error=titre");

  const jar = cookies();
  const store = parseStore(jar.get("app_sessions")?.value);

  const key = `${title}|${date}|${type}`;
  const exists = store.sessions.some(s => `${s.title}|${s.date}|${s.type}` === key && s.status === "done");
  if (exists) redirect("/dashboard/profile?success=programme:dejainclus");

  const now = new Date().toISOString();
  let exercises: NormalizedExercise[] | undefined = undefined;
  try { exercises = exercisesJson ? JSON.parse(exercisesJson) : undefined; } catch {}

  const w: Workout = {
    id: id || uid(),
    title,
    type: (["muscu", "cardio", "hiit", "mobilité"].includes(type) ? type : "muscu") as WorkoutType,
    status: "done",
    date,
    plannedMin: plannedMinStr ? Number(plannedMinStr) : undefined,
    note: note || undefined,
    createdAt: now,
    startedAt: now,
    endedAt: now,
    exercises,
  };

  const next: Store = { sessions: [w, ...store.sessions].slice(0, 300) };
  jar.set("app_sessions", JSON.stringify(next), {
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  });

  redirect("/dashboard/profile?success=programme:seance:enregistree");
}

async function completeSessionAction(formData: FormData) {
  "use server";
  const id = (formData.get("id") || "").toString();
  if (!id) redirect("/dashboard/profile");

  const store = parseStore(cookies().get("app_sessions")?.value);

  const nowISO = new Date().toISOString();
  const sessions = store.sessions.map(s => {
    if (s.id !== id) return s;
    const started = s.startedAt || nowISO;
    return { ...s, status: "done" as WorkoutStatus, startedAt: started, endedAt: nowISO };
  });

  cookies().set("app_sessions", JSON.stringify({ sessions }), {
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  });

  redirect("/dashboard/profile?done=1");
}

async function deleteSessionAction(formData: FormData) {
  "use server";
  const id = (formData.get("id") || "").toString();
  if (!id) redirect("/dashboard/profile");

  const store = parseStore(cookies().get("app_sessions")?.value);
  const sessions = store.sessions.filter(s => s.id !== id);

  cookies().set("app_sessions", JSON.stringify({ sessions }), {
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  });

  redirect("/dashboard/profile?deleted=1");
}

/* ======== Lecture des réponses par e-mail (DERNIÈRE ligne) ======== */
const NO_HEADER_COLS = { nom: 0, prenom: 1, age: 2, email: 10 }; // A,B,C,K
async function getAnswersForEmail(email: string, sheetId: string, range: string): Promise<Answers | null> {
  const data = await fetchValues(sheetId, range);
  const values: string[][] = data.values || [];
  if (values.length === 0) return null;

  const firstRowNorm = values[0].map(norm);
  const headerCandidates = ["adresse mail", "email", "e-mail", "mail"];
  const hasHeader = firstRowNorm.some(h => headerCandidates.includes(h));

  let headers: string[] = [];
  let idxEmail = -1;

  if (hasHeader) {
    headers = firstRowNorm;
    idxEmail = headers.findIndex(h => headerCandidates.includes(h));
  } else {
    const width = Math.max(values[0]?.length || 0, NO_HEADER_COLS.email + 1);
    headers = Array.from({ length: width }, (_, i) => `col${i}`);
    headers[NO_HEADER_COLS.nom]   = "nom";
    headers[NO_HEADER_COLS.prenom]= "prenom";
    headers[NO_HEADER_COLS.age]   = "age";
    headers[NO_HEADER_COLS.email] = "email";
    idxEmail = NO_HEADER_COLS.email;
  }

  if (idxEmail === -1) return null;

  // Parcours bottom-up => dernière soumission pour cet email
  const start = hasHeader ? 1 : 0;
  for (let i = values.length - 1; i >= start; i--) {
    const row = values[i] || [];
    const cell = (row[idxEmail] || "").trim().toLowerCase();
    if (!cell) continue;
    if (cell === email.trim().toLowerCase()) {
      const rec: Answers = {};
      for (let j = 0; j < row.length; j++) {
        const key = headers[j] || `col${j}`;
        rec[key] = (row[j] ?? "").trim();
      }
      rec["nom"]    = rec["nom"]    || rec[`col${NO_HEADER_COLS.nom}`]    || "";
      rec["prenom"] = rec["prenom"] || rec[`col${NO_HEADER_COLS.prenom}`] || "";
      rec["age"]    = rec["age"]    || rec[`col${NO_HEADER_COLS.age}`]    || "";
      rec["email"]  = rec["email"]  || rec[`col${NO_HEADER_COLS.email}`]  || "";
      return rec;
    }
  }
  return null;
}

/* ======== Dispo → combien de séances proposer/paginer ======== */
function inferAvailability(ans: Answers | null): number {
  if (!ans) return 3;
  const dispoRaw = (ans[norm("disponibilité")] || ans[norm("disponibilite")] || (ans as any)["disponibilité"] || (ans as any)["disponibilite"] || "").toLowerCase();
  const digits = dispoRaw.match(/\d+/g);
  if (digits?.length) {
    const n = parseInt(digits[0], 10);
    if (Number.isFinite(n)) return Math.max(1, Math.min(6, n));
  }
  if (/(lun|mar|mer|jeu|ven|sam|dim)/.test(dispoRaw)) {
    const n = dispoRaw.split(/[ ,;\/-]+/).filter(Boolean).length;
    return Math.max(1, Math.min(6, n));
  }
  return 3;
}

/* ======== Génération fallback local (si pas d’API) ======== */
function generateSessionsFromAnswers(ans: Answers): AiSession[] {
  const get = (k: string) => ans[norm(k)] || ans[k] || "";

  const prenom = get("prénom") || get("prenom");
  const age = Number((get("age") || "").replace(",", "."));
  const poids = Number((get("poids") || "").replace(",", "."));
  const taille = Number((get("taille") || "").replace(",", "."));
  const niveau = (get("niveau") || "débutant").toLowerCase();
  const objectif = (get("objectif") || "").toLowerCase();
  const dispo = (get("disponibilité") || get("disponibilite") || "").toLowerCase();
  const lieu = (get("a quel endroit v tu faire ta seance ?") || "").toLowerCase();
  const materiel = (get("as tu du matériel a ta disposition") || get("as tu du materiel a ta disposition") || "").toLowerCase();

  let freq = 3;
  const digits = dispo.match(/\d+/g);
  if (digits?.length) freq = Math.max(1, Math.min(6, parseInt(digits[0], 10)));
  else if (/(lun|mar|mer|jeu|ven|sam|dim)/.test(dispo)) {
    freq = Math.max(1, Math.min(6, dispo.split(/[ ,;\/-]+/).filter(Boolean).length));
  }

  const baseMin =
    niveau.includes("debut") || niveau.includes("début") ? 25 :
    niveau.includes("inter") ? 35 : 45;

  let intensity: "faible" | "modérée" | "élevée" =
    (niveau.includes("debut") || niveau.includes("début")) ? "faible" :
    (niveau.includes("inter")) ? "modérée" : "élevée";

  if (isFinite(age) && age >= 55) intensity = intensity === "élevée" ? "modérée" : "faible";

  const noEquip = /(aucun|non|sans)/.test(materiel) || materiel === "";
  const atGym = /(salle|gym|fitness)/.test(lieu);

  const muscuPossible = !noEquip || atGym;
  let pool: WorkoutType[] = ["cardio", "hiit", "mobilité"];
  if (muscuPossible) pool = ["muscu", "cardio", "hiit"];

  if (objectif.includes("perte") || objectif.includes("mince") || objectif.includes("seche")) {
    pool = muscuPossible ? ["hiit", "cardio", "muscu"] : ["hiit", "cardio", "mobilité"];
  } else if (objectif.includes("prise") || objectif.includes("muscle") || objectif.includes("force")) {
    pool = muscuPossible ? ["muscu", "muscu", "cardio"] : ["hiit", "cardio", "mobilité"];
  } else if (objectif.includes("endurance") || objectif.includes("cardio")) {
    pool = ["cardio", "hiit", "mobilité"];
  }

  const noteParts: string[] = [];
  if (prenom) noteParts.push(`Pour ${prenom}`);
  if (isFinite(poids) && isFinite(taille) && taille > 0) {
    const imc = Math.round((poids / Math.pow(taille/100, 2)) * 10) / 10;
    if (isFinite(imc)) noteParts.push(`IMC: ${imc}`);
  }
  if (noEquip) noteParts.push("Sans matériel");
  if (atGym) noteParts.push("Salle");

  const today = new Date();
  const nb = Math.max(1, Math.min(6, freq));
  const sessions: AiSession[] = [];
  for (let i = 0; i < nb; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i * Math.ceil(7 / nb));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const type = pool[i % pool.length];

    sessions.push({
      id: `ai-${y}${m}${d}-${i}`,
      title: `${objectif.includes("perte") ? "Brûle-graisse" : objectif.includes("prise") || objectif.includes("force") ? "Force/Muscu" : objectif.includes("endurance") || objectif.includes("cardio") ? "Endurance" : "Full body"} — Séance ${i + 1}`,
      type,
      date: `${y}-${m}-${d}`,
      plannedMin: baseMin,
      intensity,
      note: noteParts.join(" · ") || undefined,
      recommendedBy: "Coach Files",
    });
  }
  return sessions;
}

/* ===================== Page ===================== */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; done?: string; deleted?: string; take?: string; offset?: string };
}) {
  const store = parseStore(cookies().get("app_sessions")?.value);

  // "Mes séances" (actives)
  const activeAll = store.sessions
    .filter(s => s.status === "active")
    .sort((a, b) => (b.startedAt || b.createdAt || "").localeCompare(a.startedAt || a.createdAt || ""));

  // Enregistrées (done)
  const past = store.sessions
    .filter(s => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  // Propositions IA
  const programme = await fetchAiProgramme();
  const aiSessions = programme?.sessions ?? [];

  // Infos client (dernière réponse)
  const detectedEmail = await getSignedInEmail();
  const emailFromCookie = cookies().get("app_email")?.value || "";
  const emailForLink = detectedEmail || emailFromCookie;

  const clientEmailForInfos = emailForLink || "";
  let clientPrenom = "", clientNom = "", clientAge: number | undefined, clientEmailDisplay = clientEmailForInfos;
  let clientAnswers: Answers | null = null;

  if (clientEmailForInfos) {
    try {
      const ans = await getAnswersForEmail(clientEmailForInfos, SHEET_ID, SHEET_RANGE);
      clientAnswers = ans;
      const get = (k: string) => (ans ? ans[norm(k)] || ans[k] || "" : "");
      clientPrenom = get("prénom") || get("prenom") || "";
      clientNom = get("nom") || "";
      const ageStr = get("age");
      const num = Number((ageStr || "").toString().replace(",", "."));
      clientAge = isFinite(num) && num > 0 ? Math.floor(num) : undefined;

      const emailSheet = get("email") || get("adresse mail") || get("e-mail") || get("mail");
      if (!clientEmailDisplay && emailSheet) clientEmailDisplay = emailSheet;
    } catch {}
  }

  // URL questionnaire préremplie (email + prénom + nom)
  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (clientEmailDisplay) qp.set("email", clientEmailDisplay);
    if (clientPrenom) qp.set("prenom", clientPrenom);
    if (clientNom) qp.set("nom", clientNom);
    const base = QUESTIONNAIRE_BASE.replace(/\/?$/, "");
    const qs = qp.toString();
    return qs ? `${base}?${qs}` : base;
  })();

  // Dispo + pagination
  const defaultTake = inferAvailability(clientAnswers);
  const take = Math.max(1, Math.min(12, Number(searchParams?.take ?? defaultTake) || defaultTake));
  const reqOffset = Math.max(0, Number(searchParams?.offset ?? 0) || 0);

  // Propositions IA paginées
  const totalAi = aiSessions.length;
  const clampedAi = clampOffset(totalAi, take, reqOffset);
  const visibleAi = aiSessions.slice(clampedAi.offset, clampedAi.offset + take);
  const hasMoreAi = clampedAi.offset + take < totalAi;
  const showRanOutAi = clampedAi.emptyReason === "ranout" && !visibleAi.length;

  // Mes séances — dédup + pagination
  const activeUniq = uniqueBy(activeAll, s => `${s.title}|${s.date}|${s.type}`);
  const totalActive = activeUniq.length;
  const clampedActive = clampOffset(totalActive, take, reqOffset);
  const visibleActive = activeUniq.slice(clampedActive.offset, clampedActive.offset + take);
  const hasMoreActive = clampedActive.offset + take < totalActive;
  const showRanOutActive = clampedActive.emptyReason === "ranout" && !visibleActive.length;

  const rawError = searchParams?.error || "";
  const displayedError = rawError.startsWith("programme:sheetfetch:")
    ? (() => { try { return decodeURIComponent(rawError.split(":").slice(2).join(":")); } catch { return rawError; } })()
    : rawError;

  // Helper liens
  function urlWith(p: Record<string, string | number | undefined>) {
    const sp = new URLSearchParams();
    if (searchParams?.success) sp.set("success", searchParams.success);
    if (searchParams?.error) sp.set("error", searchParams.error);
    if (searchParams?.done) sp.set("done", searchParams.done);
    if (searchParams?.deleted) sp.set("deleted", searchParams.deleted);
    sp.set("take", String(p.take ?? take));
    sp.set("offset", String(p.offset ?? reqOffset));
    return `/dashboard/profile?${sp.toString()}`;
  }

  // util: tri par bloc pour l’affichage
  const blockOrder = { echauffement: 0, principal: 1, accessoires: 2, fin: 3 } as const;
  const sortByBlock = (arr: NormalizedExercise[]) =>
    arr.slice().sort((a, b) => {
      const A = a.block ? blockOrder[a.block] ?? 99 : 50;
      const B = b.block ? blockOrder[b.block] ?? 99 : 50;
      return A - B;
    });

  // rendu d’une liste d’exercices détaillés
  function ExercisesDetail({ sid, exercises }: { sid: string; exercises: NormalizedExercise[] }) {
    const exs = sortByBlock(exercises);
    return (
      <>
        <div className="text-sm font-medium mb-2">📝 Détail des exercices</div>
        <div className="text-xs text-gray-500 mb-2">Cliquez sur un exercice pour voir les consignes.</div>
        <ul className="text-sm space-y-2">
          {exs.map((ex, i) => (
            <li key={`${sid}-ex-${i}`} className="border rounded-md p-2">
              <details>
                <summary className="flex flex-wrap items-center gap-2 cursor-pointer">
                  <b className="truncate">{ex.name}</b>
                  <span className="opacity-70">
                    {typeof ex.sets === "number" ? `${ex.sets}×` : ""}{ex.reps ? `${ex.reps}` : ex.durationSec ? `${ex.durationSec}s` : ""}
                  </span>
                  {ex.rest ? <span className="opacity-60">· repos {ex.rest}</span> : null}
                  {ex.load ? <span className="opacity-60">· charge {ex.load}</span> : null}
                  {ex.tempo ? <span className="opacity-60">· tempo {ex.tempo}</span> : null}
                  {typeof ex.rir === "number" ? <span className="opacity-60">· RIR {ex.rir}</span> : null}
                  {ex.block ? <span className="opacity-60">· {ex.block}</span> : null}
                </summary>
                <div className="mt-2 text-[13px] leading-5 space-y-1">
                  {ex.target ? <div><b>Cible :</b> {ex.target}</div> : null}
                  {ex.equipment ? <div><b>Matériel :</b> {ex.equipment}</div> : null}
                  {ex.alt ? <div><b>Alternative :</b> {ex.alt}</div> : null}
                  {ex.notes ? <div><b>Consignes :</b> {ex.notes}</div> : null}
                  {ex.videoUrl ? (
                    <div><a className="underline" href={ex.videoUrl} target="_blank" rel="noreferrer">Vidéo de démonstration</a></div>
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>Mon profil</h1>
        </div>
        <a href="/dashboard" className="btn" style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500, padding: "6px 10px", lineHeight: 1.2 }}>
          ← Retour
        </a>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
            {
              searchParams.success === "programme" ? "✓ Programme IA mis à jour."
              : searchParams.success === "programme:dejainclus" ? "ℹ️ Déjà enregistrée."
              : searchParams.success === "programme:seance:enregistree" ? "✓ Séance enregistrée dans « Séances enregistrées »."
              : "✓ Séance ajoutée."
            }
          </div>
        )}
        {!!searchParams?.done && (
          <div className="card" style={{ border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.08)", fontWeight: 600 }}>
            ✓ Séance terminée.
          </div>
        )}
        {!!searchParams?.deleted && (
          <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}>
            Séance supprimée.
          </div>
        )}
        {!!searchParams?.error && (
          <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600, whiteSpace: "pre-wrap" }}>
            ⚠️ {displayedError}
          </div>
        )}
      </div>

   {/* Mes infos (dernière réponse questionnaire) */}
<section className="section" style={{ marginTop: 12 }}>
  <div className="section-head" style={{ marginBottom: 8 }}>
    <h2>Mes infos</h2>
  </div>

  <div className="card">
    <div className="text-sm" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <span><b>Prénom :</b> {clientPrenom || <i className="text-gray-400">Non renseigné</i>}</span>
      {/* ⬇️ LIGNE NOM SUPPRIMÉE */}
      <span><b>Age :</b> {typeof clientAge === "number" ? `${clientAge} ans` : <i className="text-gray-400">Non renseigné</i>}</span>
    </div>

    <div
      className="text-sm"
      style={{ marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      title={clientEmailDisplay || "Non renseigné"}
    >
      <b>Mail :</b>{" "}
      {clientEmailDisplay ? (
        <a href={`mailto:${clientEmailDisplay}`} className="underline">
          {clientEmailDisplay}
        </a>
      ) : (
        <span className="text-gray-400">Non renseigné</span>
      )}
    </div>
  </div>
</section>


      {/* Séances proposées par Files */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            writingMode: "horizontal-tb",
            textOrientation: "mixed"
          }}
        >
          <div style={{ writingMode: "horizontal-tb", textOrientation: "mixed" }}>
            <h2 style={{ marginBottom: 6 }}>Séances proposées par Files</h2>
            <p className="text-sm" style={{ color: "#6b7280", writingMode: "horizontal-tb", textOrientation: "mixed" }}>
              <b>Générées à partir de vos réponses au questionnaire.</b>
            </p>
          </div>

          {/* Bouton : "Je mets à jour" → envoie vers le questionnaire prérempli */}
          <div className="flex flex-col sm:flex-row gap-2 mt-0">
            <a
              href={questionnaireUrl}
              className="btn btn-dash"
              style={{ width: "100%", textAlign: "center" }}
            >
              Je mets à jour
            </a>
          </div>
        </div>

        {aiSessions.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>
                Pas encore de séances proposées.{" "}
                <a className="link" href={questionnaireUrl}>Répondez au questionnaire</a>, puis revenez ici.
              </span>
            </div>
          </div>
        ) : (
          <>
            {showRanOutAi && (
              <div className="card text-sm" style={{ color: "#6b7280", border: "1px dashed #d1d5db" }}>
                Tu n’as pas plus de séances pour le moment.
              </div>
            )}

            <ul className="card divide-y list-none pl-0">
              {visibleAi.map((s) => {
                const exercises = getExercises(s);
                return (
                  <li key={s.id} className="py-3">
                    <details>
                      <summary className="flex items-center justify-between cursor-pointer">
                        <div className="min-w-0">
                          <div className="font-medium truncate" style={{ fontSize: 16 }}>{s.title}</div>
                          <div className="text-sm" style={{ color: "#6b7280" }}>
                            Prévu le <b style={{ color: "inherit" }}>{fmtDateYMD(s.date)}</b>
                            {s.plannedMin ? ` · ${s.plannedMin} min` : ""}
                            {s.intensity ? ` · intensité ${s.intensity}` : ""}
                          </div>
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                          {s.type}
                        </span>
                      </summary>

                      <div className="mt-3 text-sm leading-6" style={{ whiteSpace: "pre-wrap" }}>
                        {coachText(s)}
                      </div>

                      {exercises.length > 0 && (
                        <div className="mt-3">
                          <ExercisesDetail sid={s.id} exercises={exercises} />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-8 mt-3">
                        {/* Enregistre directement dans « Séances enregistrées » */}
                        <form action={saveSingleAiSessionAction} method="post">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="title" value={s.title} />
                          <input type="hidden" name="type" value={s.type} />
                          <input type="hidden" name="date" value={s.date} />
                          {s.plannedMin ? <input type="hidden" name="plannedMin" value={String(s.plannedMin)} /> : null}
                          {s.note ? <input type="hidden" name="note" value={s.note} /> : null}
                          <input type="hidden" name="exercises" value={JSON.stringify(exercises)} />
                          <button className="btn" type="submit" style={{ background: "#111827", color: "white" }}>
                            Enregistrer dans mes séances enregistrées
                          </button>
                        </form>

                        {/* Option : ajouter aux séances actives et démarrer */}
                        <form action={addSessionAction} method="post">
                          <input type="hidden" name="title" value={s.title} />
                          <input type="hidden" name="type" value={s.type} />
                          <input type="hidden" name="date" value={s.date} />
                          {s.plannedMin ? <input type="hidden" name="plannedMin" value={String(s.plannedMin)} /> : null}
                          {s.note ? <input type="hidden" name="note" value={s.note} /> : null}
                          <input type="hidden" name="startNow" value="1" />
                          <button className="btn btn-dash" type="submit">Démarrer maintenant</button>
                        </form>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-between mt-3">
              <a href={urlWith({ take, offset: Math.max(0, clampedAi.offset - take) })} className={`btn ${clampedAi.offset <= 0 ? "pointer-events-none opacity-50" : ""}`} aria-disabled={clampedAi.offset <= 0}>← Voir précédent</a>
              <a href={urlWith({ take, offset: clampedAi.offset + take })} className={`btn ${!hasMoreAi ? "pointer-events-none opacity-50" : ""}`} aria-disabled={!hasMoreAi}>Voir plus →</a>
            </div>
          </>
        )}
      </section>

      {/* Mes séances (actives) */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Mes séances</h2>
          {totalActive > take && <span className="text-xs" style={{ color: "#6b7280" }}>Affichage de {Math.min(totalActive, clampedActive.offset + take)} / {totalActive}</span>}
        </div>

        {visibleActive.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">📅</span>
              <span>Aucune séance planifiée pour l’instant.</span>
            </div>
          </div>
        ) : (
          <>
            {showRanOutActive && (
              <div className="card text-sm" style={{ color: "#6b7280", border: "1px dashed #d1d5db" }}>
                Tu n’as pas plus de séances pour le moment.
              </div>
            )}

            <ul className="card divide-y list-none pl-0">
              {visibleActive.map((s) => (
                <li key={s.id} className="py-3">
                  <details>
                    <summary className="flex items-center justify-between cursor-pointer">
                      <div className="min-w-0">
                        <div className="font-medium truncate" style={{ fontSize: 16 }}>{s.title}</div>
                        <div className="text-sm" style={{ color: "#6b7280" }}>
                          Prévu le <b style={{ color: "inherit" }}>{fmtDateYMD(s.date)}</b>
                          {s.plannedMin ? ` · ${s.plannedMin} min` : ""}
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                        {s.type}
                      </span>
                    </summary>

                    {Array.isArray(s.exercises) && s.exercises.length > 0 && (
                      <div className="mt-3">
                        <ExercisesDetail sid={s.id} exercises={s.exercises} />
                      </div>
                    )}
                  </details>
                </li>
              ))}
            </ul>

            <div className="flex justify-between mt-3">
              <a href={urlWith({ take, offset: Math.max(0, clampedActive.offset - take) })} className={`btn ${clampedActive.offset <= 0 ? "pointer-events-none opacity-50" : ""}`} aria-disabled={clampedActive.offset <= 0}>← Voir précédent</a>
              <a href={urlWith({ take, offset: clampedActive.offset + take })} className={`btn ${!hasMoreActive ? "pointer-events-none opacity-50" : ""}`} aria-disabled={!hasMoreActive}>Voir plus →</a>
            </div>
          </>
        )}
      </section>

      {/* Séances enregistrées */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Séances enregistrées</h2>
          {past.length > 12 && <span className="text-xs" style={{ color: "#6b7280" }}>Affichage des 12 dernières</span>}
        </div>

        {past.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🗓️</span>
              <span>Aucune séance enregistrée pour l’instant.</span>
            </div>
          </div>
        ) : (
          <ul className="card divide-y list-none pl-0">
            {past.slice(0, 12).map((s) => {
              const mins = minutesBetween(s.startedAt, s.endedAt);
              return (
                <li key={s.id} className="py-3">
                  <details>
                    <summary className="flex items-center justify-between cursor-pointer">
                      <div className="min-w-0">
                        <div className="font-medium truncate" style={{ fontSize: 16 }}>{s.title}</div>
                        <div className="text-sm" style={{ color: "#6b7280" }}>
                          {fmtDateISO(s.endedAt)}
                          {mins ? ` · ${mins} min` : ""}
                          {s.plannedMin ? ` (prévu ${s.plannedMin} min)` : ""}
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                        {s.type}
                      </span>
                    </summary>

                    {Array.isArray(s.exercises) && s.exercises.length > 0 && (
                      <div className="mt-3">
                        <ExercisesDetail sid={s.id} exercises={s.exercises} />
                      </div>
                    )}

                    <div className="mt-3">
                      <form action={deleteSessionAction} method="post">
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn" type="submit" style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500 }} title="Supprimer">
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
