import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ===================== Types ===================== */
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

type AiSession = {
  id: string;
  title: string;
  type: WorkoutType;
  date: string;          // YYYY-MM-DD
  plannedMin?: number;
  note?: string;
  intensity?: "faible" | "modérée" | "élevée";
  recommendedBy?: string;
};
type AiProgramme = { sessions: AiSession[] };

/* ===================== Config ===================== */
const API_BASE = process.env.FILES_COACHING_API_BASE || "https://files-coaching.com";
const API_KEY  = process.env.FILES_COACHING_API_KEY || "";

// Google Sheets (public via lien)
const SHEET_ID      = process.env.SHEET_ID      || "1HYLsmWXJ3NIRbxH0jOiXeBPiIwrL4d2sW6JKo7ZblYTMYu4RusIji627";
const SHEET_RANGE   = process.env.SHEET_RANGE   || "reponses!A1:K1000";
// Ne PAS définir SHEET_API_KEY dans ce mode

// Questionnaire (pour le lien dans l’état vide)
const QUESTIONNAIRE_BASE = process.env.FILES_COACHING_QUESTIONNAIRE_BASE || "https://questionnaire.files-coaching.com";

/* ===================== Détection e-mail (auth) ===================== */
/** Récupère l'email du user connecté: NextAuth → cookie. */
async function getSignedInEmail(): Promise<string> {
  // NextAuth (si présent)
  try {
    // @ts-ignore import optionnel
    const { getServerSession } = await import("next-auth");
    // @ts-ignore adapte ce chemin si besoin (ex: "@/lib/auth")
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions as any);
    const email = (session as any)?.user?.email as string | undefined;
    if (email) return email;
  } catch {}

  // Cookie existant (fallback lecture seule)
  return cookies().get("app_email")?.value || "";
}

/* ============ Fetch du programme IA (affichage depuis votre API) ============ */
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
        recommendedBy: r.recommendedBy ?? r.model ?? "AI",
      }));
      return { sessions };
    } catch {}
  }
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

/* ======== Google Sheets (PUBLIC via lien) ======== */
/** Lit l’onglet public via l’endpoint CSV gviz (pas besoin d’API key). */
async function fetchValues(sheetId: string, range: string, _apiKey?: string) {
  // Nom d'onglet avant le "!"
  const sheetName = (range.split("!")[0] || "").replace(/^'+|'+$/g, "");
  if (!sheetName) throw new Error("SHEETS_RANGE_INVALID");

  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(gvizUrl, { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`SHEETS_${res.status}${txt ? ":" + txt.slice(0, 120) : ""}`);
  }

  const text = await res.text();

  // Parser CSV robuste (gère les guillemets/échappements)
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } // échappement ""
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells.map(c => c.replace(/^"|"$/g, "")));
  }

  return { values: rows };
}

type Answers = Record<string, string>;
function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a")
    .replace(/[îï]/g, "i").replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u")
    .replace(/[’']/g, "'");
}

async function getAnswersForEmail(email: string, sheetId: string, range: string): Promise<Answers | null> {
  const data = await fetchValues(sheetId, range);
  const values: string[][] = data.values || [];
  if (values.length < 2) return null;

  const headers = values[0].map(norm);
  const idxEmail = headers.findIndex(h => h === "adresse mail" || h === "email" || h === "e-mail");
  if (idxEmail === -1) return null;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row) continue;
    const cell = (row[idxEmail] || "").trim().toLowerCase();
    if (cell && cell === email.trim().toLowerCase()) {
      const rec: Answers = {};
      headers.forEach((h, j) => { rec[h] = (row[j] ?? "").trim(); });
      return rec;
    }
  }
  return null;
}

function generateSessionsFromAnswers(ans: Answers): AiSession[] {
  const get = (k: string) => ans[norm(k)] || "";

  const prenom = get("prénom") || get("prenom");
  const age = Number((get("age") || "").replace(",", "."));
  const poids = Number((get("poids") || "").replace(",", "."));
  const taille = Number((get("taille") || "").replace(",", "."));
  const niveau = get("niveau").toLowerCase() || "débutant";
  const objectif = get("objectif").toLowerCase();
  const dispo = get("disponibilité").toLowerCase() || get("disponibilite").toLowerCase();
  const lieu = get("a quel endroit v tu faire ta seance ?").toLowerCase();
  const materiel = get("as tu du matériel a ta disposition").toLowerCase() || get("as tu du materiel a ta disposition").toLowerCase();

  // fréquence de séances / semaine
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
      recommendedBy: "AI",
    });
  }
  return sessions;
}

/* ===================== Actions serveur ===================== */
async function buildProgrammeAction() {
  "use server";

  // 0) Détecter automatiquement l'email via NextAuth/cookie (et mémoriser si trouvé)
  let email = await getSignedInEmail();
  if (email) {
    cookies().set("app_email", email, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false });
  }

  // 1) Tente l’API Files Coaching (indépendamment de l’email)
  const uid = cookies().get("fc_uid")?.value || "me";
  const endpoints = [
    `${API_BASE}/api/programme/build`,
    `${API_BASE}/api/program/build`,
    `${API_BASE}/api/sessions/build`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(`${url}?user=${encodeURIComponent(uid)}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        },
        body: JSON.stringify({ user: uid, source: "app-profile" }),
        cache: "no-store",
      });
      if (res.ok) {
        redirect("/dashboard/profile?success=programme");
      }
    } catch {}
  }

  // 2) Fallback Google Sheets — nécessite l'e-mail détecté
  if (!email) {
    redirect("/dashboard/profile?error=programme:noemail");
  }

  try {
    const answers = await getAnswersForEmail(email, SHEET_ID, SHEET_RANGE);
    if (!answers) {
      redirect("/dashboard/profile?error=programme:nomatch");
    }

    const aiSessions = generateSessionsFromAnswers(answers!);

    // pousser en local dans app_sessions
    const jar = cookies();
    const store = parseStore(jar.get("app_sessions")?.value);
    const now = new Date().toISOString();

    const mapped: Workout[] = aiSessions.map(s => ({
      id: s.id,
      title: s.title,
      type: s.type,
      status: "active",
      date: s.date,
      plannedMin: s.plannedMin,
      note: s.note,
      createdAt: now,
      startedAt: undefined,
      endedAt: undefined,
    }));

    const next: Store = { sessions: [...mapped, ...store.sessions].slice(0, 300) };
    jar.set("app_sessions", JSON.stringify(next), {
      path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
    });

    redirect("/dashboard/profile?success=programme");
  } catch (e: any) {
    // >>> Afficher l'erreur complète (message détaillé) dans l'UI
    const msg = String(e?.message || "unknown");
    const encoded = encodeURIComponent(msg);
    if (msg.startsWith("SHEETS_")) {
      // Avant: on ne renvoyait que le code (ex: 404). Maintenant on renvoie le message entier.
      redirect(`/dashboard/profile?error=programme:sheetfetch:${encoded}`);
    }
    redirect(`/dashboard/profile?error=programme:sheetfetch:${encoded}`);
  }
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

/* ===================== Page ===================== */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; done?: string; deleted?: string };
}) {
  const store = parseStore(cookies().get("app_sessions")?.value);

  const active = store.sessions
    .filter(s => s.status === "active")
    .sort((a, b) => (b.startedAt || b.createdAt || "").localeCompare(a.startedAt || a.createdAt || ""));

  const past = store.sessions
    .filter(s => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  const defaultDate = toYMD();

  // Affichage informatif si votre API renvoie déjà un programme
  const programme = await fetchAiProgramme();
  const aiSessions = programme?.sessions ?? [];

  // On NE set PAS de cookie ici (évite l’erreur serveur). On lit juste pour préremplir le lien.
  const detectedEmail = await getSignedInEmail();
  const emailFromCookie = cookies().get("app_email")?.value || "";
  const emailForLink = detectedEmail || emailFromCookie;

  const questionnaireUrl = emailForLink
    ? `${QUESTIONNAIRE_BASE}?email=${encodeURIComponent(emailForLink)}`
    : QUESTIONNAIRE_BASE;

  // --- Mes infos (nom, prénom, email) ---
  const clientEmailForInfos = emailForLink || "";
  let clientNom = "", clientPrenom = "";

  if (clientEmailForInfos) {
    try {
      const ans = await getAnswersForEmail(clientEmailForInfos, SHEET_ID, SHEET_RANGE);
      const get = (k: string) => (ans ? ans[norm(k)] || "" : "");
      clientNom = get("nom") || get("nom de famille") || "";
      clientPrenom = get("prénom") || get("prenom") || "";
    } catch {}
  }

  // Préparer message d'erreur lisible si on a "programme:sheetfetch:<message encodé>"
  const rawError = searchParams?.error || "";
  let displayedError = rawError;
  if (rawError.startsWith("programme:sheetfetch:")) {
    // tout ce qui suit le deuxième ":" correspond au message complet encodé
    const parts = rawError.split(":");
    const full = parts.slice(2).join(":"); // garde le message complet
    try {
      displayedError = decodeURIComponent(full);
    } catch {
      displayedError = full; // au cas où
    }
  }

  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)",
      }}
    >
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            Mon profil
          </h1>
          <p className="lead">Gérez vos séances et gardez un historique clair de votre entraînement.</p>
        </div>
        <a
          href="/dashboard"
          className="btn"
          style={{
            background: "#ffffff",
            color: "#111827",
            border: "1px solid #d1d5db",
            fontWeight: 500,
            padding: "6px 10px",
            lineHeight: 1.2,
          }}
        >
          ← Retour
        </a>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
            ✓ {searchParams.success === "programme" ? "Programme généré." : "Séance ajoutée."}
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
            {/* Affiche le message complet décodé si dispo */}
            ⚠️ Erreur : {displayedError}
          </div>
        )}
      </div>

      {/* Mes infos */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Mes infos</h2>
        </div>

        <div className="card">
          <div className="grid gap-3" style={{ gridTemplateColumns: "140px 1fr" }}>
            <div className="contents">
              <span className="text-gray-500">Nom</span>
              <span className="font-medium break-words">{clientNom || <i className="text-gray-400">Non renseigné</i>}</span>
            </div>
            <div className="contents">
              <span className="text-gray-500">Prénom</span>
              <span className="font-medium break-words">{clientPrenom || <i className="text-gray-400">Non renseigné</i>}</span>
            </div>
            <div className="contents">
              <span className="text-gray-500">E-mail</span>
              {emailForLink ? (
                <a href={`mailto:${emailForLink}`} className="font-medium underline break-words">{emailForLink}</a>
              ) : (
                <span className="font-medium"><i className="text-gray-400">Non renseigné</i></span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mon programme (IA) */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ marginBottom: 6 }}>Mon programme (personnalisé par l’IA)</h2>

        {/* Un seul CTA */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <form action={buildProgrammeAction}>
              <button className="btn btn-dash" type="submit" style={{ width: "100%" }}>
                Créer mon programme
              </button>
            </form>
          </div>
        </div>

        {aiSessions.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>
                Pas encore de séances générées.{" "}
                <a className="link" href={questionnaireUrl}>Répondez au questionnaire</a>
                , puis appuyez sur « Créer mon programme ».
              </span>
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
                  {s.note ? (<><br />Note : <i>{s.note}</i></>) : null}
                </div>

                {/* Convertir en séance locale */}
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
                    {s.note ? (<><br />Note : <i>{s.note}</i></>) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
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

