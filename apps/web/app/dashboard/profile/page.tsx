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
  tempo?: string;
  rir?: number;
  load?: string;
  equipment?: string;
  target?: string;
  alt?: string;
  videoUrl?: string;
  block?: "echauffement" | "principal" | "fin" | "accessoires";
};

type Workout = {
  id: string;
  title: string;
  type: WorkoutType;
  status: WorkoutStatus;
  date: string;
  plannedMin?: number;
  startedAt?: string;
  endedAt?: string;
  note?: string;
  createdAt: string;
  exercises?: NormalizedExercise[];
};

type Store = { sessions: Workout[] };

type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string;
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
const SHEET_ID    = process.env.SHEET_ID    || "1XH-BOUj4tXAVy49ONBIdLiWM97hQ-Fg8h5-OTRGvHC4";
const SHEET_RANGE = process.env.SHEET_RANGE || "Réponses!A1:K";
const SHEET_GID   = process.env.SHEET_GID   || "1160551014";
const QUESTIONNAIRE_BASE = process.env.FILES_COACHING_QUESTIONNAIRE_BASE || "https://questionnaire.files-coaching.com";

/* ===================== Auth ===================== */
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

/* ===================== Fetch IA ===================== */
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
        headers: { Accept: "application/json", ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) },
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
        plannedMin: typeof r.plannedMin === "number" ? r.plannedMin : typeof r.duration === "number" ? r.duration : undefined,
        note: typeof r.note === "string" ? r.note : typeof r.notes === "string" ? r.notes : undefined,
        intensity: r.intensity as any,
        recommendedBy: r.recommendedBy ?? r.model ?? "Coach Files",
        exercises: Array.isArray(r.exercises) ? r.exercises : undefined,
        blocks: Array.isArray(r.blocks) ? r.blocks : undefined,
        plan: r.plan,
        content: r.content,
      }));
      return { sessions };
    } catch {}
  }

  // fallback local depuis la dernière réponse
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
function clampOffset(total: number, take: number, offset: number) {
  if (total <= 0) return { offset: 0, emptyReason: "none" as const };
  if (offset >= total) return { offset: Math.max(0, Math.ceil(total / take) * take - take), emptyReason: "ranout" as const };
  return { offset, emptyReason: "none" as const };
}
function uniqueBy<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>(); const out: T[] = [];
  for (const item of arr) { const k = key(item); if (!seen.has(k)) { seen.add(k); out.push(item); } }
  return out;
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

/* ======== Normalisation ======== */
type Answers = Record<string, string>;
function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
    .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a").replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u").replace(/[’']/g, "'");
}

/* ======== Génération fallback si pas d’API ======== */
function inferAvailability(ans: Answers | null): number {
  if (!ans) return 3;
  const dispoRaw = (ans[norm("disponibilité")] || ans[norm("disponibilite")] || (ans as any)["disponibilité"] || (ans as any)["disponibilite"] || "").toLowerCase();
  const digits = dispoRaw.match(/\d+/g);
  if (digits?.length) { const n = parseInt(digits[0], 10); if (Number.isFinite(n)) return Math.max(1, Math.min(6, n)); }
  if (/(lun|mar|mer|jeu|ven|sam|dim)/.test(dispoRaw)) {
    const n = dispoRaw.split(/[ ,;\/-]+/).filter(Boolean).length;
    return Math.max(1, Math.min(6, n));
  }
  return 3;
}
function generateSessionsFromAnswers(ans: Answers): AiSession[] {
  const get = (k: string) => ans[norm(k)] || ans[k] || "";
  const prenom = get("prénom") || get("prenom");
  const age = Number((get("age") || "").replace(",", "."));
  const niveau = (get("niveau") || "débutant").toLowerCase();
  const objectif = (get("objectif") || "").toLowerCase();
  const dispo = (get("disponibilité") || get("disponibilite") || "").toLowerCase();
  const lieu = (get("a quel endroit v tu faire ta seance ?") || "").toLowerCase();
  const materiel = (get("as tu du matériel a ta disposition") || get("as tu du materiel a ta disposition") || "").toLowerCase();

  let freq = 3; const digits = dispo.match(/\d+/g);
  if (digits?.length) freq = Math.max(1, Math.min(6, parseInt(digits[0], 10)));
  else if (/(lun|mar|mer|jeu|ven|sam|dim)/.test(dispo)) freq = Math.max(1, Math.min(6, dispo.split(/[ ,;\/-]+/).filter(Boolean).length));

  const baseMin = niveau.includes("debut") || niveau.includes("début") ? 25 : niveau.includes("inter") ? 35 : 45;
  let intensity: "faible" | "modérée" | "élevée" = (niveau.includes("debut") || niveau.includes("début")) ? "faible" : (niveau.includes("inter")) ? "modérée" : "élevée";
  if (isFinite(age) && age >= 55) intensity = intensity === "élevée" ? "modérée" : "faible";

  const noEquip = /(aucun|non|sans)/.test(materiel) || materiel === "";
  const atGym = /(salle|gym|fitness)/.test(lieu);
  const muscuPossible = !noEquip || atGym;

  let pool: WorkoutType[] = muscuPossible ? ["muscu", "cardio", "hiit"] : ["cardio", "hiit", "mobilité"];
  if (objectif.includes("perte") || objectif.includes("mince") || objectif.includes("seche")) pool = muscuPossible ? ["hiit","cardio","muscu"] : ["hiit","cardio","mobilité"];
  else if (objectif.includes("prise") || objectif.includes("muscle") || objectif.includes("force")) pool = muscuPossible ? ["muscu","muscu","cardio"] : ["hiit","cardio","mobilité"];
  else if (objectif.includes("endurance") || objectif.includes("cardio")) pool = ["cardio","hiit","mobilité"];

  const noteParts: string[] = [];
  if (prenom) noteParts.push(`Pour ${prenom}`);
  if (noEquip) noteParts.push("Sans matériel");
  if (atGym) noteParts.push("Salle");

  const today = new Date(); const nb = Math.max(1, Math.min(6, freq)); const sessions: AiSession[] = [];
  for (let i = 0; i < nb; i++) {
    const date = new Date(today); date.setDate(today.getDate() + i * Math.ceil(7/nb));
    const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,"0"), d = String(date.getDate()).padStart(2,"0");
    const type = pool[i % pool.length];
    sessions.push({
      id: `ai-${y}${m}${d}-${i}`,
      title: `${objectif.includes("perte") ? "Brûle-graisse" : objectif.includes("prise") || objectif.includes("force") ? "Force/Muscu" : objectif.includes("endurance") || objectif.includes("cardio") ? "Endurance" : "Full body"} — Séance ${i+1}`,
      type, date: `${y}-${m}-${d}`, plannedMin: baseMin, intensity, note: noteParts.join(" · ") || undefined, recommendedBy: "Coach Files",
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

  // (SUPPRIMÉ) "Mes séances (actives)"

  // Enregistrées (done)
  const past = store.sessions
    .filter(s => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  // Propositions IA
  const programme = await fetchAiProgramme();
  const aiSessions = programme?.sessions ?? [];

  // Infos client
  const detectedEmail = await getSignedInEmail();
  const emailFromCookie = cookies().get("app_email")?.value || "";
  const emailForLink = detectedEmail || emailFromCookie;

  // Questionnaire URL préremplie
  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (emailForLink) qp.set("email", emailForLink);
    const base = QUESTIONNAIRE_BASE.replace(/\/?$/, "");
    const qs = qp.toString();
    return qs ? `${base}?${qs}` : base;
  })();

  // Pagination IA (moins de détails affichés)
  const takeDefault = 3;
  const take = Math.max(1, Math.min(12, Number(searchParams?.take ?? takeDefault) || takeDefault));
  const reqOffset = Math.max(0, Number(searchParams?.offset ?? 0) || 0);

  const totalAi = aiSessions.length;
  const clampedAi = clampOffset(totalAi, take, reqOffset);
  const visibleAi = aiSessions.slice(clampedAi.offset, clampedAi.offset + take);
  const hasMoreAi = clampedAi.offset + take < totalAi;

  const rawError = searchParams?.error || "";
  const displayedError = rawError;

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

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}>
      {/* Header */}
      <div className="page-header">
        <div><h1 className="h1" style={{ fontSize: 22 }}>Mon profil</h1></div>
        <a href="/dashboard" className="btn" style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500, padding: "6px 10px", lineHeight: 1.2 }}>← Retour</a>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
            {searchParams.success === "programme" ? "✓ Programme IA mis à jour."
            : searchParams.success === "programme:dejainclus" ? "ℹ️ Déjà enregistrée."
            : searchParams.success === "programme:seance:enregistree" ? "✓ Séance enregistrée."
            : "✓ Séance ajoutée."}
          </div>
        )}
        {!!searchParams?.done && (<div className="card" style={{ border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.08)", fontWeight: 600 }}>✓ Séance terminée.</div>)}
        {!!searchParams?.deleted && (<div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}>Séance supprimée.</div>)}
        {!!searchParams?.error && (<div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600, whiteSpace: "pre-wrap" }}>⚠️ {displayedError}</div>)}
      </div>

      {/* Séances proposées par Files — version compacte */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>Séances proposées par Files</h2>
            <p className="text-sm" style={{ color: "#6b7280" }}>Cliquez sur une séance pour voir le détail complet.</p>
          </div>
          <a href={questionnaireUrl} className="btn btn-dash">Je mets à jour</a>
        </div>

        {visibleAi.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>Pas encore de séances. <a className="link" href={questionnaireUrl}>Remplissez le questionnaire</a>, puis revenez ici.</span>
            </div>
          </div>
        ) : (
          <>
            <ul className="card divide-y list-none pl-0">
              {visibleAi.map((s) => {
                // Lien robuste: id + title/date/type en query
                const qp = new URLSearchParams({ title: s.title, date: s.date, type: s.type, plannedMin: s.plannedMin ? String(s.plannedMin) : "" });
                const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;
                return (
                  <li key={s.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <a href={href} className="font-medium underline-offset-2 hover:underline" style={{ fontSize: 16 }}>
                          {s.title}
                        </a>
                        <div className="text-sm" style={{ color: "#6b7280" }}>
                          Prévu le <b style={{ color: "inherit" }}>{fmtDateYMD(s.date)}</b>{s.plannedMin ? ` · ${s.plannedMin} min` : ""}{s.intensity ? ` · intensité ${s.intensity}` : ""}
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>{s.type}</span>
                    </div>
                    {/* Plus de coachText ni de liste d’exercices ici */}
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

      {/* Séances enregistrées — version compacte */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Séances enregistrées</h2>
          {past.length > 12 && <span className="text-xs" style={{ color: "#6b7280" }}>Affichage des 12 dernières</span>}
        </div>

        {past.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🗓️</span>
              <span>Aucune séance enregistrée.</span>
            </div>
          </div>
        ) : (
          <ul className="card divide-y list-none pl-0">
            {past.slice(0, 12).map((s) => {
              const mins = minutesBetween(s.startedAt, s.endedAt);
              const qp = new URLSearchParams({ title: s.title, date: s.date, type: s.type, plannedMin: s.plannedMin ? String(s.plannedMin) : "" });
              const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;
              return (
                <li key={s.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <a href={href} className="font-medium underline-offset-2 hover:underline" style={{ fontSize: 16 }}>
                        {s.title}
                      </a>
                      <div className="text-sm" style={{ color: "#6b7280" }}>
                        {fmtDateISO(s.endedAt)}{mins ? ` · ${mins} min` : ""}{s.plannedMin ? ` (prévu ${s.plannedMin} min)` : ""}
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>{s.type}</span>
                  </div>

                  <div className="mt-3">
                    <form action={deleteSessionAction} method="post">
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn" type="submit" style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500 }}>Supprimer</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ===================== Actions serveur ===================== */
function uid() { return "id-" + Math.random().toString(36).slice(2, 10); }
function toYMD(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
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

/* ======== Lecture des réponses (DERNIÈRE ligne) ======== */
const NO_HEADER_COLS = { nom: 0, prenom: 1, age: 2, email: 10 };
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

