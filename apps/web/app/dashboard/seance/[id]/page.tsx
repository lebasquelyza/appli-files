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

type Answers = Record<string, string>;
type EquipLevel = "full" | "limited" | "none";

/** ===== Config ===== */
const API_BASE = process.env.FILES_COACHING_API_BASE || "https://files-coaching.com";
const API_KEY  = process.env.FILES_COACHING_API_KEY || "";
const SHEET_ID    = process.env.SHEET_ID    || "1XH-BOUj4tXAVy49ONBIdLiWM97hQ-Fg8h5-OTRGvHC4";
const SHEET_RANGE = process.env.SHEET_RANGE || "Réponses!A1:K";
const SHEET_GID   = process.env.SHEET_GID   || "1160551014";

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
function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g," ")
    .replace(/[éèêë]/g,"e").replace(/[àâä]/g,"a").replace(/[îï]/g,"i")
    .replace(/[ôö]/g,"o").replace(/[ùûü]/g,"u").replace(/[’']/g,"'");
}

/** ===== Sheets (lecture publique CSV) ===== */
async function fetchValues(sheetId: string, range: string) {
  const sheetName = (range.split("!")[0] || "").replace(/^'+|'+$/g, "");
  const tries: string[] = [];
  if (SHEET_GID) {
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=${encodeURIComponent(SHEET_GID)}`);
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(SHEET_GID)}`);
    tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${encodeURIComponent(SHEET_GID)}`);
  }
  if (sheetName) tries.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);

  for (const url of tries) {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text().catch(() => "");
    if (res.ok && !text.trim().startsWith("<")) {
      const rows: string[][] = [];
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      for (const line of lines) {
        const cells: string[] = [];
        let cur = "", inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; } }
          else if (ch === "," && !inQuotes) { cells.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        cells.push(cur.trim());
        rows.push(cells.map(c => c.replace(/^"|"$/g, "")));
      }
      return { values: rows };
    }
  }
  throw new Error("SHEETS_FETCH_FAILED");
}

const NO_HEADER_COLS = { nom: 0, prenom: 1, age: 2, email: 10 };
async function getAnswersForEmail(email: string, sheetId: string, range: string): Promise<Answers | null> {
  const data = await fetchValues(sheetId, range);
  const values: string[][] = data.values || [];
  if (values.length === 0) return null;

  const headerCandidates = ["adresse mail", "email", "e-mail", "mail"].map(norm);
  const firstRowNorm = values[0].map(norm);
  const hasHeader = firstRowNorm.some(h => headerCandidates.includes(h));
  let headers: string[] = []; let idxEmail = -1;

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

  const start = hasHeader ? 1 : 0;
  for (let i = values.length - 1; i >= start; i--) {
    const row = values[i] || [];
    const cell = (row[idxEmail] || "").trim().toLowerCase();
    if (!cell) continue;
    if (cell === email.trim().toLowerCase()) {
      const rec: any = {};
      for (let j = 0; j < row.length; j++) { rec[headers[j] || `col${j}`] = (row[j] ?? "").trim(); }
      rec["email"]  = rec["email"]  || rec[`col${NO_HEADER_COLS.email}`]  || "";
      rec["prenom"] = rec["prenom"] || rec[`col${NO_HEADER_COLS.prenom}`] || "";
      rec["age"]    = rec["age"]    || rec[`col${NO_HEADER_COLS.age}`]    || "";
      rec["nom"]    = rec["nom"]    || rec[`col${NO_HEADER_COLS.nom}`]    || "";
      return rec as Answers;
    }
  }
  return null;
}

async function getSignedInEmail(): Promise<string> {
  try {
    // @ts-ignore
    const { getServerSession } = await import("next-auth");
    // @ts-ignore
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions as any);
    const email = (session as any)?.user?.email as string | undefined;
    if (email) return email;
  } catch {}
  return cookies().get("app_email")?.value || "";
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

/** ===== Matériel ===== */
function inferEquipment(materiel: string, lieu: string): EquipLevel {
  const m = norm(materiel); const l = norm(lieu);
  if (/(salle|gym|fitness|basic-fit|keepcool|neo|temple|crossfit)/.test(l)) return "full";
  if (/(aucun|rien|sans)/.test(m) || m === "") return "none";
  return "limited";
}

/** ===== Fallback exos selon objectif + matériel (déduit via le titre + sheet) ===== */
function goalFromTitle(t: string): "hypertrophy"|"fatloss"|"strength"|"endurance"|"mobility"|"general" {
  const s = t.toLowerCase();
  if (s.includes("hypertroph")) return "hypertrophy";
  if (s.includes("fatloss")) return "fatloss";
  if (s.includes("force")) return "strength";
  if (s.includes("endurance")) return "endurance";
  if (s.includes("mobil")) return "mobility";
  return "general";
}
function ex(name: string, p: Partial<NormalizedExercise> = {}): NormalizedExercise { return { name, ...p }; }

function fallbackExercisesByGoalAndEquip(title: string, type: WorkoutType, level: EquipLevel, plannedMin?: number): NormalizedExercise[] {
  const g = goalFromTitle(title);
  const dur = plannedMin ?? (g === "mobility" ? 30 : g === "endurance" ? 40 : 50);

  const BW = (n:string,p:Partial<NormalizedExercise>={})=>ex(n,{...p,equipment:"poids du corps"});
  const DB = (n:string,p:Partial<NormalizedExercise>={})=>ex(n,{...p,equipment:"haltères"});
  const KB = (n:string,p:Partial<NormalizedExercise>={})=>ex(n,{...p,equipment:"kettlebell"});
  const BB = (n:string,p:Partial<NormalizedExercise>={})=>ex(n,{...p,equipment:"barre"});
  const MC = (n:string,p:Partial<NormalizedExercise>={})=>ex(n,{...p,equipment:"machine/câble"});

  // HYPO : on choisit une variante en fonction du matériel
  const muscuUpper = () => {
    if (level === "full") return [
      BB("Développé couché",{sets:4,reps:"6–10",rest:"90s",tempo:"3-1-1",rir:2,target:"pectoraux, triceps",block:"principal"}),
      MC("Tirage vertical",{sets:4,reps:"8–12",rest:"75s",rir:2,target:"dos, biceps",block:"principal"}),
      MC("Écarté poulie",{sets:3,reps:"12–15",rest:"60s",block:"accessoires"}),
      MC("Oiseau poulie",{sets:3,reps:"12–15",rest:"60s",block:"accessoires"}),
      ex("Planche",{sets:2,reps:"45s",rest:"45s",block:"fin"}),
    ];
    if (level === "limited") return [
      DB("Développé haltères",{sets:4,reps:"6–10",rest:"90s",rir:2,block:"principal"}),
      DB("Rowing unilatéral",{sets:4,reps:"8–12/ côté",rest:"75s",rir:2,block:"principal"}),
      DB("Élévations latérales",{sets:3,reps:"12–15",rest:"60s",block:"accessoires"}),
      DB("Curl incliné",{sets:3,reps:"10–12",rest:"60s",block:"accessoires"}),
      ex("Planche",{sets:2,reps:"45s",rest:"45s",block:"fin"}),
    ];
    return [
      BW("Pompes",{sets:4,reps:"8–12",rest:"75s",rir:2,block:"principal"}),
      BW("Tractions australiennes / table",{sets:4,reps:"10–12",rest:"75s",block:"principal"}),
      BW("Dips banc / chaises",{sets:3,reps:"10–12",rest:"60s",block:"accessoires"}),
      BW("Pike push-up",{sets:3,reps:"6–10",rest:"60s",block:"accessoires"}),
      ex("Planche",{sets:2,reps:"45s",rest:"45s",block:"fin"}),
    ];
  };
  const muscuLower = () => {
    if (level === "full") return [
      BB("Back Squat",{sets:4,reps:"6–8",rest:"120s",load:"75–80% 1RM",block:"principal"}),
      BB("Soulevé de terre JT",{sets:4,reps:"8–10",rest:"90s",block:"principal"}),
      MC("Presse à cuisses",{sets:3,reps:"10–12",rest:"90s",block:"accessoires"}),
      MC("Leg curl",{sets:3,reps:"12–15",rest:"75s",block:"accessoires"}),
      ex("Core (planche lat.)",{sets:2,reps:"30–45s/côté",rest:"45s",block:"fin"}),
    ];
    if (level === "limited") return [
      DB("Goblet Squat",{sets:4,reps:"8–12",rest:"90s",block:"principal"}),
      KB("Soulevé JT",{sets:4,reps:"10–12",rest:"90s",block:"principal"}),
      DB("Fentes marchées",{sets:3,reps:"12/ jambe",rest:"75s",block:"accessoires"}),
      DB("Mollets debout",{sets:3,reps:"12–15",rest:"60s",block:"accessoires"}),
      ex("Core (dead bug)",{sets:2,reps:"8–10",rest:"45s",block:"fin"}),
    ];
    return [
      BW("Squat PB lent (3-1-1)",{sets:4,reps:"12–15",rest:"75s",tempo:"3-1-1",block:"principal"}),
      BW("Fente arrière",{sets:4,reps:"10–12/ jambe",rest:"75s",block:"principal"}),
      BW("Hip thrust 1 jambe",{sets:3,reps:"10–12/ jambe",rest:"60s",block:"accessoires"}),
      BW("Mollets sur marche",{sets:3,reps:"15–20",rest:"45s",block:"accessoires"}),
      ex("Core (hollow/planche)",{sets:2,reps:"30–45s",rest:"45s",block:"fin"}),
    ];
  };

  if (g === "hypertrophy") {
    const isUpper = /haut|upper/i.test(title);
    const isLower = /bas|lower/i.test(title);
    if (isUpper) return muscuUpper();
    if (isLower) return muscuLower();
    return [...muscuLower().slice(0,3), ...muscuUpper().slice(0,2)];
  }

  if (g === "strength") {
    if (level === "full") {
      if (/bas|lower/i.test(title)) {
        return [
          ex("Back Squat (5×5)",{sets:5,reps:5,rest:"150s",load:"75–80% 1RM",block:"principal"}),
          ex("Soulevé de terre (3×5)",{sets:3,reps:5,rest:"180s",load:"80–85% 1RM",block:"principal"}),
          ex("Split squat",{sets:3,reps:"6–8/ jambe",rest:"90s",block:"accessoires"}),
          ex("Gainage lat.",{sets:2,reps:"30–45s/ côté",rest:"45s",block:"fin"}),
        ];
      }
      return [
        ex("Développé couché (5×5)",{sets:5,reps:5,rest:"150s",load:"75–80% 1RM",block:"principal"}),
        ex("Rowing barre (5×5)",{sets:5,reps:5,rest:"120s",load:"75–80% 1RM",block:"principal"}),
        ex("Développé militaire",{sets:3,reps:"5–6",rest:"120s",block:"accessoires"}),
        ex("Tractions lestées",{sets:3,reps:"4–6",rest:"120s",block:"accessoires"}),
      ];
    }
    // limited/none : schéma force avec charges dispo / tempo lent PB
    if (/bas|lower/i.test(title)) {
      return [
        DB("Goblet Squat lourd",{sets:5,reps:"5–6",rest:"120s",block:"principal"}),
        DB("Soulevé JT",{sets:4,reps:"6–8",rest:"120s",block:"principal"}),
        BW("Fente bulgare lente",{sets:3,reps:"6–8/ jambe",rest:"90s",tempo:"3-1-1",block:"accessoires"}),
      ];
    }
    return [
      DB("Développé haltères assis",{sets:5,reps:"5–6",rest:"120s",block:"principal"}),
      DB("Rowing unilatéral strict",{sets:5,reps:"5–6/ côté",rest:"120s",block:"principal"}),
      BW("Pompes tempo 3-1-1",{sets:3,reps:"6–10",rest:"90s",tempo:"3-1-1",block:"accessoires"}),
      BW("Tractions australiennes lestées sac",{sets:3,reps:"6–10",rest:"90s",block:"accessoires"}),
    ];
  }

  if (g === "fatloss") {
    if (level === "none") {
      return [
        ex("Échauffement cardio",{sets:1,reps:"8–10 min",block:"echauffement"}),
        ex("HIIT 30s ON/30s OFF",{sets:10,reps:"30s/30s",rest:"90s après 5",notes:"RPE 8",block:"principal"}),
        ex("Circuit core PB (planche, hollow, mountain climbers)",{sets:2,reps:"3 ex × 30s",rest:"30s",block:"fin"}),
        ex("Marche active quotidienne",{sets:1,reps:"20–40 min",block:"fin"}),
      ];
    }
    return [
      ex("Échauffement cardio",{sets:1,reps:"8–10 min",block:"echauffement"}),
      ex("Circuit métabolique 3–4 tours",{notes:"6 ex : squats, tirage, pompes, fentes, swing/rameur, abdos",block:"principal"}),
      ex("Retour au calme + respiration",{sets:1,reps:"6–8 min",block:"fin"}),
    ];
  }

  if (g === "endurance") {
    if (/4×4|4x4/i.test(title)) {
      return [
        ex("Échauffement Z1",{sets:1,reps:"10 min",block:"echauffement"}),
        ex("Intervalles 4×4",{sets:4,reps:"4 min Z4",rest:"3 min Z1–Z2",block:"principal"}),
        ex("Retour au calme + mobilité",{sets:1,reps:"8–10 min",block:"fin"}),
      ];
    }
    if (/tempo/i.test(title)) {
      return [
        ex("Échauffement progressif",{sets:1,reps:"12 min",block:"echauffement"}),
        ex("Tempo run",{sets:1,reps:"20–25 min @ seuil",block:"principal"}),
        ex("Retour au calme",{sets:1,reps:"8–10 min",block:"fin"}),
      ];
    }
    return [
      ex("Échauffement",{sets:1,reps:"8–10 min",block:"echauffement"}),
      ex("Cardio continu Z2",{sets:1,reps:`${Math.max(20,dur-15)} min`,block:"principal"}),
      ex("Retour au calme + mobilité",{sets:1,reps:"6–8 min",block:"fin"}),
    ];
  }

  if (g === "mobility") {
    return [
      ex("Respiration diaphragmatique",{sets:1,reps:"2–3 min",block:"echauffement"}),
      ex("90/90 hanches",{sets:2,reps:"8–10/ côté",rest:"30–45s",block:"principal"}),
      ex("T-spine rotations",{sets:2,reps:"8–10/ côté",rest:"30–45s",block:"principal"}),
      ex("Cossack squats assistés",{sets:2,reps:"6–8/ côté",rest:"45s",block:"principal"}),
      ex("Down-Dog → Cobra",{sets:2,reps:"6–8",rest:"30s",block:"fin"}),
    ];
  }

  // Général
  if (level === "full") {
    return [
      ex("Presse à cuisses",{sets:4,reps:"8–12",rest:"90s",block:"principal"}),
      ex("Développé couché",{sets:4,reps:"6–10",rest:"90s",block:"principal"}),
      ex("Tirage câble",{sets:4,reps:"8–12",rest:"75s",block:"principal"}),
      ex("Élévations latérales",{sets:3,reps:"12–15",rest:"60s",block:"accessoires"}),
      ex("Crunch câble",{sets:3,reps:"12–15",rest:"45s",block:"fin"}),
    ];
  }
  if (level === "limited") {
    return [
      DB("Goblet Squat",{sets:3,reps:"8–12",rest:"75s",block:"principal"}),
      DB("Développé haltères",{sets:3,reps:"8–12",rest:"75s",block:"principal"}),
      DB("Rowing unilatéral",{sets:3,reps:"10–12/ côté",rest:"75s",block:"principal"}),
      DB("Hip hinge (JT)",{sets:3,reps:"8–10",rest:"90s",block:"accessoires"}),
      ex("Planche",{sets:2,reps:"30–45s",rest:"45s",block:"fin"}),
    ];
  }
  return [
    BW("Squat PB",{sets:3,reps:"12–15",rest:"60–75s",block:"principal"}),
    BW("Pompes",{sets:3,reps:"8–12",rest:"60–75s",block:"principal"}),
    BW("Tractions australiennes",{sets:3,reps:"10–12",rest:"60–75s",block:"principal"}),
    BW("Hip thrust PB",{sets:3,reps:"12–15",rest:"60–75s",block:"accessoires"}),
    ex("Planche",{sets:2,reps:"30–45s",rest:"45s",block:"fin"}),
  ];
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

  // cookies
  const store = parseStore(cookies().get("app_sessions")?.value);
  let saved = store.sessions.find(s => s.id === id);

  // IA
  const programme = await fetchAiProgramme();
  const aiById = programme?.sessions.find(s => s.id === id);

  // query fallback
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

  // Matériel : lire la sheet pour ajuster le détail si on n'a pas d'exos IA
  let equipLevel: EquipLevel = "limited";
  try {
    const email = await getSignedInEmail();
    if (email) {
      const ans = await getAnswersForEmail(email, SHEET_ID, SHEET_RANGE);
      const get = (k: string) => (ans ? ans[norm(k)] || ans[k] || "" : "");
      const lieu = get("a quel endroit v tu faire ta seance ?") || "";
      const materiel = get("as tu du matériel a ta disposition") || get("as tu du materiel a ta disposition") || "";
      equipLevel = inferEquipment(materiel, lieu);
    }
  } catch {}

  // Construire la séance
  let title = "", type: WorkoutType = "muscu", date = "", plannedMin: number | undefined, intensity: "faible"|"modérée"|"élevée" | undefined;
  let exercises: NormalizedExercise[] = [];

  if (saved) {
    title = saved.title; type = saved.type; date = saved.date; plannedMin = saved.plannedMin;
    exercises = Array.isArray(saved.exercises) ? saved.exercises : [];
  } else if (ai) {
    title = ai.title; type = ai.type; date = ai.date; plannedMin = ai.plannedMin; intensity = ai.intensity || "modérée";
    const raw = Array.isArray((ai as any).exercises) ? (ai as any).exercises : [];
    exercises = raw.length ? raw as NormalizedExercise[] : fallbackExercisesByGoalAndEquip(title, type, equipLevel, plannedMin);
  } else if (qpTitle && qpDate && qpType) {
    title = qpTitle; type = qpType; date = qpDate; plannedMin = qpPlannedMin; intensity = "modérée";
    exercises = fallbackExercisesByGoalAndEquip(title, type, equipLevel, plannedMin);
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
    type === "muscu" ? "Objectif : exécution solide et progression des charges."
  : type === "cardio" ? "Objectif : aérobie stable, souffle contrôlé."
  : type === "hiit" ? "Objectif : pics d’intensité courts, qualité du geste."
  : "Objectif : amplitude articulaire confortable, sans douleur.";
  const coachTips =
    type === "muscu" ? "Laisse 1–2 reps en réserve sur la dernière série."
  : type === "cardio" ? "Reste en Z2 : tu peux parler en phrases courtes."
  : type === "hiit" ? "Coupe une série si la technique se dégrade."
  : "Mouvement lent, respirations profondes, jamais de douleur nette.";

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
          {"\n"}⏱️ Durée: {plannedMin ? `${plannedMin} min` : "25–60 min"} · Intensité: {intensity || "modérée"}
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
