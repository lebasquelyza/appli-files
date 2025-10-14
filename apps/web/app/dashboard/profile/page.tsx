import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ===== Types =====
type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";
type WorkoutStatus = "active" | "done";

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
};

type Store = { sessions: Workout[] };

// ====== "Mon programme" (IA) ======
type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string;          // YYYY-MM-DD
  plannedMin?: number;
  note?: string;
  intensity?: "faible" | "modérée" | "élevée";
  recommendedBy?: string; // "AI" | modèle …
};

type AiProgramme = { sessions: AiSession[] };

// === Helpers & fetch depuis Google Sheets ===
function normalizeHeader(h: string) {
  return h.trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a")
    .replace(/[îï]/g, "i").replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u");
}

function mapRowToAiSession(row: Record<string, string>, idx: number): AiSession {
  const title = row["titre"] || row["title"] || row["seance"] || `Séance ${idx + 1}`;
  const type = (row["type"] || row["categorie"] || "muscu") as WorkoutType;
  const date = row["date"] || row["jour"] || new Date().toISOString().slice(0,10);
  const plannedMin = row["duree"] || row["duree (min)"] || row["duration"];
  const note = row["note"] || row["notes"] || row["commentaire"] || "";
  const intensity = (row["intensite"] || row["intensity"]) as AiSession["intensity"];
  return {
    id: row["id"] || `ai-${idx}`,
    title: String(title),
    type: ["muscu","cardio","hiit","mobilité"].includes(type) ? type : "muscu",
    date: String(date),
    plannedMin: plannedMin ? Number(String(plannedMin).replace(",",".")) : undefined,
    note: note || undefined,
    intensity,
    recommendedBy: "AI",
  };
}

// ID Google Sheet fourni (override possible via .env)
const SHEET_ID      = process.env.SHEET_ID      || "1HYLsmWXJ3NIRbxH0jOiXeBPiIwrL4d2sW6JKo7ZblYTMYu4RusIji627";
const SHEET_RANGE   = process.env.SHEET_RANGE   || "";   // ex: Programme!A1:F1000  (recommandé si API)
const SHEET_GID     = process.env.SHEET_GID     || "";   // ex: 0 (CSV d’un onglet spécifique)
const SHEET_API_KEY = process.env.SHEET_API_KEY || "";   // pour l’API Values

async function fetchCsv(url: string): Promise<AiProgramme | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.length > 0);
    if (lines.length === 0) return { sessions: [] };
    const headers = lines[0].split(",").map(normalizeHeader);
    const sessions: AiSession[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h] = (cols[j] ?? "").trim(); });
      sessions.push(mapRowToAiSession(row, i - 1));
    }
    return { sessions };
  } catch { return null; }
}

async function fetchValuesApi(sheetId: string, range: string, apiKey?: string): Promise<AiProgramme | null> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const url = apiKey ? `${base}?key=${apiKey}` : base;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const values: string[][] = data?.values || [];
    if (values.length === 0) return { sessions: [] };
    const headers = values[0].map(normalizeHeader);
    const sessions = values.slice(1).map((arr: string[], i: number) => {
      const row: Record<string,string> = {};
      headers.forEach((h, j) => { row[h] = (arr[j] ?? "").trim(); });
      return mapRowToAiSession(row, i);
    });
    return { sessions };
  } catch { return null; }
}

async function fetchAiProgrammeFromSheet(): Promise<AiProgramme | null> {
  if (!SHEET_ID) return null;

  // 1) JSON via API (propre si cellules avec virgules/retours ligne)
  if (SHEET_RANGE) {
    const viaApi = await fetchValuesApi(SHEET_ID, SHEET_RANGE, SHEET_API_KEY || undefined);
    if (viaApi) return viaApi;
  }

  // 2) CSV via export d’un onglet précis
  if (SHEET_GID) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const viaCsv = await fetchCsv(csvUrl);
    if (viaCsv) return viaCsv;
  }

  // 3) CSV du premier onglet (fallback)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  return await fetchCsv(csvUrl);
}

// ===== Utils =====
function parseStore(val?: string | null): Store {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as Workout[] };
  } catch {}
  return { sessions: [] };
}

function uid() {
  return "id-" + Math.random().toString(36).slice(2, 10);
}
function toYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function fmtDateISO(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {}
  return iso || "—";
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
  } catch {}
  return ymd;
}
function minutesBetween(a?: string, b?: string) {
  if (!a || !b) return undefined;
  const A = new Date(a).getTime();
  const B = new Date(b).getTime();
  if (!isFinite(A) || !isFinite(B)) return undefined;
  const mins = Math.round((B - A) / 60000);
  return mins >= 0 ? mins : undefined;
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

/* ===== Server Actions (non exportées) ===== */
async function addSessionAction(formData: FormData) {
  "use server";
  const title = (formData.get("title") || "").toString().trim();
  const type = (formData.get("type") || "muscu").toString() as WorkoutType;
  const date = (formData.get("date") || toYMD()).toString();
  const plannedMinStr = (formData.get("plannedMin") || "").toString().replace(",", ".");
  const note = (formData.get("note") || "").toString().slice(0, 240);
  const startNow = (formData.get("startNow") || "").toString() === "1";

  if (!title) redirect("/dashboard/profile?error=titre");

  const jar = cookies();
  const store = parseStore(jar.get("app_sessions")?.value);

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

  const jarOpts: any = { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false };
  cookies().set("app_sessions", JSON.stringify(next), jarOpts);

  redirect("/dashboard/profile?success=1");
}

async function completeSessionAction(formData: FormData) {
  "use server";
  const id = (formData.get("id") || "").toString();
  if (!id) redirect("/dashboard/profile");

  const jar = cookies();
  const store = parseStore(jar.get("app_sessions")?.value);

  const nowISO = new Date().toISOString();
  const sessions = store.sessions.map(s => {
    if (s.id !== id) return s;
    const started = s.startedAt || nowISO;
    return { ...s, status: "done" as WorkoutStatus, startedAt: started, endedAt: nowISO };
  });

  cookies().set("app_sessions", JSON.stringify({ sessions }), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false });

  redirect("/dashboard/profile?done=1");
}

async function deleteSessionAction(formData: FormData) {
  "use server";
  const id = (formData.get("id") || "").toString();
  if (!id) redirect("/dashboard/profile");

  const store = parseStore(cookies().get("app_sessions")?.value);
  const sessions = store.sessions.filter(s => s.id !== id);

  cookies().set("app_sessions", JSON.stringify({ sessions }), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false });

  redirect("/dashboard/profile?deleted=1");
}

/* ===== Page ===== */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; done?: string; deleted?: string };
}) {
  const jar = cookies();
  const store = parseStore(jar.get("app_sessions")?.value);

  const active = store.sessions
    .filter(s => s.status === "active")
    .sort((a, b) => (b.startedAt || b.createdAt || "").localeCompare(a.startedAt || a.createdAt || ""));

  const past = store.sessions
    .filter(s => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  const defaultDate = toYMD();

  // ===== Récupération du programme IA (depuis Google Sheets) =====
  const programme = await fetchAiProgrammeFromSheet();
  const aiSessions = programme?.sessions ?? [];

  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)", // ⟵ même taille héritée que la 1ʳᵉ page
      }}
    >
      {/* Header */}
      <div className="page-header">
        <div>
          <h1
            className="h1"
            style={{ fontSize: 22 }} // ⟵ titre principal fixé à 22px
          >
            Mon profil
          </h1>
          <p className="lead">Gérez vos séances et gardez un historique clair de votre entraînement.</p>
        </div>
        {/* Bouton secondaire : noir sur blanc */}
        <a
          href="/dashboard"
          className="btn"
          style={{
            background: "#ffffff",
            color: "#111827",
            border: "1px solid #d1d5db",
            fontWeight: 500,
            padding: "6px 10px",
            lineHeight: 1.2
          }}
        >
          ← Retour
        </a>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
            ✓ Séance ajoutée.
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
          <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}>
            ⚠️ Erreur : {searchParams.error}
          </div>
        )}
      </div>

      {/* Ajouter une séance (manuel) */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Ajouter une séance</h2>
        </div>

        <div className="card">
          <form action={addSessionAction} className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="label">Titre</label>
              <input
                className="input"
                type="text"
                name="title"
                placeholder="ex: Full body, Cardio 20', HIIT Tabata…"
                required
              />
            </div>

            <div>
              <label className="label">Type</label>
              <select className="input" name="type" defaultValue="muscu" required>
                <option value="muscu">Muscu</option>
                <option value="cardio">Cardio</option>
                <option value="hiit">HIIT</option>
                <option value="mobilité">Mobilité</option>
              </select>
            </div>

            <div>
              <label className="label">Date prévue</label>
              <input className="input" type="date" name="date" defaultValue={defaultDate} required />
            </div>

            <div>
              <label className="label">Durée prévue (min) — optionnel</label>
              <input className="input" type="number" inputMode="numeric" name="plannedMin" placeholder="ex: 30" />
            </div>

            <div className="lg:col-span-2">
              <label className="label">Note — optionnel</label>
              <input className="input" type="text" name="note" placeholder="ex: accent sur jambes / intervalles 30-30" />
            </div>

            <input type="hidden" name="startNow" value="1" />
            <div className="lg:col-span-3" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              {/* Principal = vert */}
              <button className="btn btn-dash" type="submit">Démarrer maintenant</button>
            </div>
          </form>
        </div>
      </div>

      {/* Mon programme (IA) */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Mon programme (personnalisé par l’IA)</h2>
          <div className="text-xs" style={{ color: "#6b7280" }}>
            {aiSessions.length > 0 ? `Source : Google Sheets (${SHEET_ID ? SHEET_ID.slice(0,6)+'…' : 'non configuré'})` : ""}
          </div>
        </div>

        {aiSessions.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>Pas encore de séances générées. Remplis le questionnaire et alimente la feuille liée pour voir ton programme ici.</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {aiSessions.map((s) => (
              <article key={s.id} className="card" style={{ transition: "box-shadow .2s" }}>
                <div className="flex items-start justify-between gap-3">
                  <strong style={{ fontSize: 16 }}>{s.title}</strong>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                    {s.type}
                  </span>
                </div>

                <div className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
                  Prévu le <b style={{ color: "inherit" }}>{fmtDateYMD(s.date)}</b>
                  {s.plannedMin ? ` · ${s.plannedMin} min` : ""}
                  {s.intensity ? ` · intensité ${s.intensity}` : ""}
                  {s.note ? (
                    <>
                      <br />
                      Note : <i>{s.note}</i>
                    </>
                  ) : null}
                </div>

                {/* Option : convertir en séance locale */}
                <form action={addSessionAction} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input type="hidden" name="title" value={s.title} />
                  <input type="hidden" name="type" value={s.type} />
                  <input type="hidden" name="date" value={s.date} />
                  {s.plannedMin ? <input type="hidden" name="plannedMin" value={String(s.plannedMin)} /> : null}
                  {s.note ? <input type="hidden" name="note" value={s.note} /> : null}
                  <input type="hidden" name="startNow" value="1" />
                  <button className="btn btn-dash" type="submit">Démarrer cette séance</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Mes séances passées */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Mes séances passées</h2>
          {past.length > 12 && <span className="text-xs" style={{ color: "#6b7280" }}>Affichage des 12 dernières</span>}
        </div>

        {past.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🗓️</span>
              <span>Aucune séance terminée pour l’instant.</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {past.slice(0, 12).map((s) => {
              const mins = minutesBetween(s.startedAt, s.endedAt);
              return (
                <article key={s.id} className="card" style={{ transition: "box-shadow .2s" }}>
                  <div className="flex items-start justify-between gap-3">
                    <strong style={{ fontSize: 16 }}>{s.title}</strong>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                      {s.type}
                    </span>
                  </div>

                  <div className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
                    Le <b style={{ color: "inherit" }}>{fmtDateISO(s.endedAt)}</b>
                    {mins ? ` · ${mins} min` : ""}
                    {s.plannedMin ? ` (prévu ${s.plannedMin} min)` : ""}
                    {s.note ? (
                      <>
                        <br />
                        Note : <i>{s.note}</i>
                      </>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      {/* Secondaire = NOIR SUR BLANC */}
                      <button
                        className="btn"
                        type="submit"
                        style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500 }}
                      >
                        Supprimer
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}


