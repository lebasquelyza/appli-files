// apps/web/app/dashboard/profile/page.tsx
import { cookies } from "next/headers";

/** ================= ENV (avec valeurs de secours) ================= */
const SHEET_ID = process.env.SHEET_ID || "";
const SHEET_RANGE = process.env.SHEET_RANGE || "A1:Z9999";
const SHEET_GID = process.env.SHEET_GID || "";
const API_BASE = process.env.FILES_COACHING_API_BASE || process.env.APP_BASE_URL || "";
const API_KEY = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY || "";
const QUESTIONNAIRE_BASE = process.env.FILES_COACHING_QUESTIONNAIRE_BASE || "/questionnaire";

type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

type Workout = {
  id: string;
  title: string;
  type: WorkoutType;
  status: "active" | "done";
  date: string;
  plannedMin?: number;
  startedAt?: string;
  endedAt?: string;
  note?: string;
  createdAt: string;
};

type Store = { sessions: Workout[] };

type AiExercise = {
  name: string;
  reps?: string;
  sets?: number;
  durationSec?: number;
  rest?: string;
  rir?: string | number;
  tempo?: string;
  notes?: string;
  alt?: string;
};

type AiBlock = {
  name: "echauffement" | "principal" | "accessoires" | "fin";
  items: AiExercise[];
};

type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string;
  plannedMin?: number;
  note?: string;
  intensity?: string | number;
  recommendedBy?: string;
  exercises?: AiExercise[];
  blocks?: AiBlock[];
  plan?: any;
  content?: any;
};

type AiProgramme = { sessions: AiSession[] };
type Answers = Record<string, string>;

/** ================= Helpers ================= */
const norm = (s: string) =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function parseStore(val?: string | null): Store {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val!);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as Workout[] };
  } catch (e) {
    console.warn("profile/parseStore: invalid cookie JSON", e);
  }
  return { sessions: [] };
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

/** ================= Google Sheets ================= */
async function fetchValues(sheetId: string, range: string) {
  const sheetName = (range.split("!")[0] || "").replace(/^'+|'+$/g, "");
  if (!sheetId) throw new Error("SHEETS_CONFIG_MISSING");

  const tries: string[] = [];
  if (SHEET_GID) {
    tries.push(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=${encodeURIComponent(
        SHEET_GID
      )}`
    );
    tries.push(
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(SHEET_GID)}`
    );
    tries.push(
      `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${encodeURIComponent(SHEET_GID)}`
    );
  }
  if (sheetName) {
    tries.push(
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
    );
  }

  for (const url of tries) {
    const res = await fetch(url, { cache: "no-store" });
    const lastCT = res.headers.get("content-type") || "";
    const text = await res.text().catch(() => "");
    if (res.ok) {
      const looksHtml = text.trim().startsWith("<") || lastCT.includes("text/html");
      if (looksHtml) continue;

      const rows: string[][] = [];
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      for (const line of lines) {
        const cells: string[] = [];
        let cur = "", inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
          } else if (ch === "," && !inQuotes) {
            cells.push(cur.trim()); cur = "";
          } else { cur += ch; }
        }
        cells.push(cur.trim());
        rows.push(cells.map((c) => c.replace(/^"|"$/g, "")));
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

  const firstRowNorm = values[0].map(norm);
  const headerCandidates = ["adresse mail", "email", "e-mail", "mail"];
  const hasHeader = firstRowNorm.some((h) => headerCandidates.includes(h));

  let headers: string[] = [];
  let idxEmail = -1;

  if (hasHeader) {
    headers = firstRowNorm;
    idxEmail = headers.findIndex((h) => headerCandidates.includes(h));
  } else {
    const width = Math.max(values[0]?.length || 0, NO_HEADER_COLS.email + 1);
    headers = Array.from({ length: width }, (_, i) => `col${i}`);
    headers[NO_HEADER_COLS.nom] = "nom";
    headers[NO_HEADER_COLS.prenom] = "prenom";
    headers[NO_HEADER_COLS.age] = "age";
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
      rec["nom"] = rec["nom"] || rec[`col${NO_HEADER_COLS.nom}`] || "";
      rec["prenom"] = rec["prenom"] || rec[`col${NO_HEADER_COLS.prenom}`] || "";
      rec["age"] = rec["age"] || rec[`col${NO_HEADER_COLS.age}`] || "";
      rec["email"] = rec["email"] || rec[`col${NO_HEADER_COLS.email}`] || "";
      return rec;
    }
  }
  return null;
}

async function getSignedInEmail(): Promise<string | null> {
  // ici on lit uniquement le cookie, c'est ce que ta page seance sait déjà faire aussi
  return cookies().get("app_email")?.value || null;
}

/** ================= Fetch IA Programme =================
 * - Utilise API_BASE si présent (absolu)
 * - Ajoute des endpoints **relatifs** si API_BASE est vide
 * - Mappe souplement les champs côté API
 */
async function fetchAiProgramme(userId?: string): Promise<AiProgramme | null> {
  const uidFromCookie = cookies().get("fc_uid")?.value;
  const uid = userId || uidFromCookie || "me";

  const abs = (p: string) => (API_BASE ? `${API_BASE.replace(/\/$/, "")}${p}` : "");
  const rel = (p: string) => `${p}`;

  const candidateUrls = [
    abs(`/api/programme?user=${encodeURIComponent(uid)}`),
    abs(`/api/program?user=${encodeURIComponent(uid)}`),
    abs(`/api/sessions?source=ai&user=${encodeURIComponent(uid)}`),
    abs(`/api/ai/programme?user=${encodeURIComponent(uid)}`),
    abs(`/api/ai/sessions?user=${encodeURIComponent(uid)}`),
    // relatifs
    rel(`/api/programme?user=${encodeURIComponent(uid)}`),
    rel(`/api/program?user=${encodeURIComponent(uid)}`),
    rel(`/api/sessions?source=ai&user=${encodeURIComponent(uid)}`),
    rel(`/api/ai/programme?user=${encodeURIComponent(uid)}`),
    rel(`/api/ai/sessions?user=${encodeURIComponent(uid)}`),
  ].filter(Boolean);

  for (const url of candidateUrls) {
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
        id: String(r.id ?? r._id ?? `ai-${i}`),
        title: String(r.title ?? r.name ?? "Séance personnalisée"),
        type: (String(r.type ?? r.category ?? "muscu").toLowerCase() as WorkoutType),
        date: String(r.date ?? r.day ?? r.when ?? new Date().toISOString().slice(0, 10)),
        plannedMin:
          typeof r.plannedMin === "number" ? r.plannedMin : typeof r.duration === "number" ? r.duration : undefined,
        note: typeof r.note === "string" ? r.note : typeof r.notes === "string" ? r.notes : undefined,
        intensity: r.intensity as any,
        recommendedBy: r.recommendedBy ?? r.model ?? "Coach Files",
        exercises: Array.isArray(r.exercises) ? r.exercises : undefined,
        blocks: Array.isArray(r.blocks) ? r.blocks : undefined,
        plan: r.plan,
        content: r.content,
      }));
      return { sessions };
    } catch (e) {
      console.warn("fetchAiProgramme failed for", url, e);
    }
  }

  // Fallback questionnaire ⇒ séance unique (même logique qu'avant)
  try {
    const email = (await getSignedInEmail()) || cookies().get("app_email")?.value || "";
    if (email && SHEET_ID) {
      const ans = await getAnswersForEmail(email, SHEET_ID, SHEET_RANGE);
      if (ans) {
        const sessions: AiSession[] = [
          {
            id: "ai-fallback-1",
            title: "Séance perso (fallback)",
            type: "muscu",
            date: new Date().toISOString().slice(0, 10),
            plannedMin: 45,
            note: "Générée depuis le questionnaire (fallback)",
          },
        ];
        return { sessions };
      }
    }
  } catch (e) {
    console.warn("fallback-from-questionnaire failed", e);
  }

  return null;
}

/** ================= Page ================= */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; done?: string; deleted?: string };
}) {
  // Store local (cookie)
  const store = parseStore(cookies().get("app_sessions")?.value);

  const past = store.sessions
    .filter((s) => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  // Mes infos (depuis la dernière réponse Sheets)
  const detectedEmail = await getSignedInEmail();
  const emailFromCookie = cookies().get("app_email")?.value || "";
  const emailForLink = detectedEmail || emailFromCookie;

  let clientPrenom = "",
    clientAge: number | undefined,
    clientEmailDisplay = emailForLink;

  try {
    if (emailForLink && SHEET_ID) {
      const ans = await getAnswersForEmail(emailForLink, SHEET_ID, SHEET_RANGE);
      if (ans) {
        const get = (k: string) => ans[norm(k)] || ans[k] || "";
        clientPrenom = get("prénom") || get("prenom") || "";
        const ageStr = get("age");
        const num = Number((ageStr || "").toString().replace(",", "."));
        clientAge = Number.isFinite(num) && num > 0 ? Math.floor(num) : undefined;
        const emailSheet = get("email") || get("adresse mail") || get("e-mail") || get("mail");
        if (!clientEmailDisplay && emailSheet) clientEmailDisplay = emailSheet;
      }
    }
  } catch (e) {
    console.warn("Sheets answers fetch failed", e);
  }

  // Propositions IA (sans pagination)
  const programme = await fetchAiProgramme();
  const aiSessions = programme?.sessions ?? [];

  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (clientEmailDisplay) qp.set("email", clientEmailDisplay);
    if (clientPrenom) qp.set("prenom", clientPrenom);
    const base = QUESTIONNAIRE_BASE.replace(/\/?$/, "");
    const qs = qp.toString();
    return qs ? `${base}?${qs}` : base;
  })();

  const displayedError = searchParams?.error || "";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}>
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            Mon profil
          </h1>
        </div>
        <a
          href="/dashboard"
          className="btn"
          style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500, padding: "6px 10px", lineHeight: 1.2 }}
        >
          ← Retour
        </a>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
            {searchParams.success === "programme"
              ? "✓ Programme IA mis à jour."
              : searchParams.success === "programme:dejainclus"
              ? "ℹ️ Déjà enregistrée."
              : searchParams.success === "programme:seance:enregistree"
              ? "✓ Séance enregistrée."
              : "✓ Séance ajoutée."}
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
        {!!displayedError && (
          <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600, whiteSpace: "pre-wrap" }}>
            ⚠️ {displayedError}
          </div>
        )}
      </div>

      {/* ===== Mes infos ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Mes infos</h2>
        </div>
        <div className="card">
          <div className="text-sm" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>
              <b>Prénom :</b> {clientPrenom || <i className="text-gray-400">Non renseigné</i>}
            </span>
            <span>
              <b>Âge :</b> {typeof clientAge === "number" ? `${clientAge} ans` : <i className="text-gray-400">Non renseigné</i>}
            </span>
          </div>
          <div className="text-sm" style={{ marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={clientEmailDisplay || "Non renseigné"}>
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

      {/* ===== Séances proposées (IA) ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <h2 style={{ marginBottom: 6 }}>Séances proposées</h2>
            <p className="text-sm" style={{ color: "#6b7280" }}>Personnalisées via l’analyse de vos réponses.</p>
          </div>
          <a href={questionnaireUrl} className="btn btn-dash">
            Je mets à jour
          </a>
        </div>

        {aiSessions.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>
                Pas encore de séances. <a className="link" href={questionnaireUrl}>Remplissez le questionnaire</a>.
              </span>
            </div>
          </div>
        ) : (
          <ul className="space-y-2 list-none pl-0">
            {aiSessions.map((s) => {
              const qp = new URLSearchParams({
                title: s.title,
                date: s.date,
                type: s.type,
                plannedMin: s.plannedMin ? String(s.plannedMin) : "",
                // Force la régénération IA + badge debug côté page séance :
                regen: "1",
                debug: "1",
              });
              const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;
              return (
                <li key={s.id} className="card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={href}
                      className="font-medium underline-offset-2 hover:underline truncate"
                      style={{ fontSize: 16, display: "inline-block", maxWidth: "100%" }}
                      title={s.title}
                    >
                      {s.title}
                    </a>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                      {s.type}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ===== Séances enregistrées ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h2>Séances enregistrées</h2>
          {past.length > 12 && (
            <span className="text-xs" style={{ color: "#6b7280" }}>
              Affichage des 12 dernières
            </span>
          )}
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
              const qp = new URLSearchParams({
                title: s.title,
                date: s.date,
                type: s.type,
                plannedMin: s.plannedMin ? String(s.plannedMin) : "",
                regen: "0",
                debug: "1",
              });
              const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;

              return (
                <li key={s.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <a href={href} className="font-medium underline-offset-2 hover:underline" style={{ fontSize: 16 }}>
                        {s.title}
                      </a>
                      <div className="text-sm" style={{ color: "#6b7280" }}>
                        {fmtDateISO(s.endedAt)}
                        {s.plannedMin ? ` (prévu ${s.plannedMin} min)` : ""}
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                      {s.type}
                    </span>
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
