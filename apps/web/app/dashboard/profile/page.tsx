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
  recommendedBy?: string; // "AI"
};

/* ===================== Config ===================== */
// Google Sheets
const SHEET_ID      = process.env.SHEET_ID      || "1HYLsmWXJ3NIRbxH0jOiXeBPiIwrL4d2sW6JKo7ZblYTMYu4RusIji627";
const SHEET_RANGE   = process.env.SHEET_RANGE   || "Reponses!A1:Z1000"; // adapte au nom d’onglet/plage
const SHEET_API_KEY = process.env.SHEET_API_KEY || "";                   // requis si la feuille n'est pas publique
// Questionnaire (ton site)
const QUESTIONNAIRE_URL = process.env.QUESTIONNAIRE_URL || "https://www.files-coaching.com/questionnaire";

/* ===================== Utils généraux ===================== */
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

/* ===================== Helpers (Questionnaire & Sheets) ===================== */
function getUserEmail() {
  // Adapte si tu utilises une autre source (session DB, JWT…)
  return cookies().get("app_email")?.value || "";
}
function normalizeKey(s: string) {
  return s.trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a")
    .replace(/[îï]/g, "i").replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u")
    .replace(/[’']/g, "'").replace(/\?/g, "?");
}

async function fetchValues(sheetId: string, range: string, apiKey?: string) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const url = apiKey ? `${base}?key=${apiKey}` : base;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

type Answers = Record<string, string>;

/** Lit la ligne correspondant à l'email avec les entêtes EXACTES communiquées. */
async function getAnswersForEmail(email: string): Promise<Answers | null> {
  if (!email) return null;
  const data = await fetchValues(SHEET_ID, SHEET_RANGE, SHEET_API_KEY || undefined);
  if (!data) return null;

  const values: string[][] = data.values || [];
  if (values.length < 2) return null;

  // Entêtes exactes (données par toi)
  const expectedHeaders = [
    "prénom", "age", "poids", "taille", "niveau",
    "objectif", "disponibilité", "a quel endroit v tu faire ta seance ?",
    "as tu du matériel a ta disposition", "adresse mail"
  ].map(normalizeKey);

  const headers = values[0].map(normalizeKey);

  // S'assurer que "adresse mail" existe
  const idxEmail = headers.findIndex(h => h === normalizeKey("adresse mail") || h === "email" || h === "e-mail");
  if (idxEmail === -1) return null;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if ((row[idxEmail] || "").trim().toLowerCase() === email.trim().toLowerCase()) {
      const rec: Answers = {};
      headers.forEach((h, j) => { rec[h] = (row[j] ?? "").trim(); });
      // garantir les clés
      expectedHeaders.forEach(k => { if (!(k in rec)) rec[k] = ""; });
      return rec;
    }
  }
  return null;
}

/** Génération réellement personnalisée selon réponses */
function generateSessionsFromAnswers(ans: Answers): AiSession[] {
  const get = (k: string) => ans[normalizeKey(k)] || "";

  const prenom = get("prénom");
  const age = Number((get("age") || "").replace(",", "."));
  const poids = Number((get("poids") || "").replace(",", "."));
  const taille = Number((get("taille") || "").replace(",", "."));
  const niveau = get("niveau").toLowerCase() || "débutant";
  const objectif = get("objectif").toLowerCase();
  const dispo = get("disponibilité").toLowerCase();
  const lieu = get("a quel endroit v tu faire ta seance ?").toLowerCase();
  const materiel = get("as tu du matériel a ta disposition").toLowerCase();

  // ---- Fréquence à partir de "disponibilité"
  // exemples acceptés: "3", "3x", "3 séances", "lun/mer/ven"
  let freq = 3;
  const digits = dispo.match(/\d+/g);
  if (digits?.length) {
    freq = Math.max(1, Math.min(6, parseInt(digits[0], 10)));
  } else if (/(lun|mar|mer|jeu|ven|sam|dim)/.test(dispo)) {
    freq = Math.max(1, Math.min(6, dispo.split(/[ ,;\/-]+/).filter(Boolean).length));
  }

  // ---- Durée & intensité selon niveau/âge
  const baseMin =
    niveau.includes("debut") || niveau.includes("début") ? 25 :
    niveau.includes("inter") ? 35 :
    45;

  let intensity: "faible" | "modérée" | "élevée" =
    (niveau.includes("debut") || niveau.includes("début")) ? "faible" :
    (niveau.includes("inter")) ? "modérée" : "élevée";

  // Ajustement par âge (si > 55, on baisse un cran d'intensité)
  if (isFinite(age) && age >= 55) {
    intensity = intensity === "élevée" ? "modérée" : "faible";
  }

  // ---- Contrainte lieu / matériel
  const noEquip = /(aucun|non|sans)/.test(materiel) || materiel === "";
  const atHome = /(maison|domicile|home)/.test(lieu);
  const atGym = /(salle|gym|fitness)/.test(lieu);

  // ---- Choix du pool de types selon objectif + contraintes
  const muscuPossible = !noEquip || atGym; // muscu + charges surtout si salle ou matériel
  let pool: WorkoutType[] = ["cardio", "hiit", "mobilité"];
  if (muscuPossible) pool = ["muscu", "cardio", "hiit"];

  if (objectif.includes("perte") || objectif.includes("mince") || objectif.includes("seche")) {
    pool = muscuPossible ? ["hiit", "cardio", "muscu"] : ["hiit", "cardio", "mobilité"];
  } else if (objectif.includes("prise") || objectif.includes("muscle") || objectif.includes("force")) {
    pool = muscuPossible ? ["muscu", "muscu", "cardio"] : ["hiit", "cardio", "mobilité"];
  } else if (objectif.includes("endurance") || objectif.includes("cardio")) {
    pool = ["cardio", "hiit", "mobilité"];
  }

  // ---- Personnalisation titre + note
  const baseTitle =
    objectif.includes("perte") ? "Brûle-graisse" :
    objectif.includes("force") || objectif.includes("prise") ? "Force/Muscu" :
    objectif.includes("endurance") || objectif.includes("cardio") ? "Endurance" :
    "Full body";

  const noteParts: string[] = [];
  if (prenom) noteParts.push(`Pour ${prenom}`);
  if (isFinite(poids) && isFinite(taille) && taille > 0) {
    const imc = Math.round((poids / Math.pow(taille/100, 2)) * 10) / 10;
    if (isFinite(imc)) noteParts.push(`IMC: ${imc}`);
  }
  if (atHome) noteParts.push("Lieu: maison");
  if (atGym) noteParts.push("Lieu: salle");
  if (noEquip) noteParts.push("Sans matériel");

  // ---- Calendrier: étale sur la semaine (J+0, +2, +4, ...)
  const today = new Date();
  const sessions: AiSession[] = [];
  const nb = Math.max(1, Math.min(6, freq));
  for (let i = 0; i < nb; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i * Math.ceil(7 / nb)); // réparti sur la semaine
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const type = pool[i % pool.length];

    sessions.push({
      id: `ai-${y}${m}${d}-${i}`,
      title: `${baseTitle} — Séance ${i + 1}`,
      type,
      date: `${y}-${m}-${d}`,
      plannedMin: baseMin,
      intensity,
      note: noteParts.length ? noteParts.join(" · ") : undefined,
      recommendedBy: "AI",
    });
  }
  return sessions;
}

/* ===================== Server Actions (questionnaire & génération) ===================== */
// 1) Ouvrir le questionnaire avec l'email pré-rempli
async function startQuestionnaireAction() {
  "use server";
  const email = getUserEmail();
  const url = email ? `${QUESTIONNAIRE_URL}?email=${encodeURIComponent(email)}` : QUESTIONNAIRE_URL;
  redirect(url);
}

// 2) Lire le Sheet pour l'email + générer les séances IA et les stocker localement
async function buildProgramFromSheetAction() {
  "use server";
  const email = getUserEmail();
  if (!email) redirect("/dashboard/profile?error=email");

  const answers = await getAnswersForEmail(email);
  if (!answers) redirect("/dashboard/profile?error=reponses_introuvables");

  const sessionsIA = generateSessionsFromAnswers(answers);

  // Ajoute les séances générées en "active"
  const jar = cookies();
  const store = parseStore(jar.get("app_sessions")?.value);
  const now = new Date().toISOString();

  const mapped: Workout[] = sessionsIA.map(s => ({
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
  cookies().set("app_sessions", JSON.stringify(next), {
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  });

  redirect("/dashboard/profile?success=programme");
}

/* ===================== Server Actions existantes ===================== */
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
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const past = store.sessions
    .filter(s => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  const defaultDate = toYMD();

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>Mon profil</h1>
          <p className="lead">Gérez vos séances et gardez un historique clair de votre entraînement.</p>
        </div>
        <a href="/dashboard" className="btn" style={{ background:"#fff", color:"#111827", border:"1px solid #d1d5db", fontWeight:500, padding:"6px 10px", lineHeight:1.2 }}>
          ← Retour
        </a>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!searchParams?.success && <div className="card" style={{ border:"1px solid rgba(16,185,129,.35)", background:"rgba(16,185,129,.08)", fontWeight:600 }}>✓ Action effectuée.</div>}
        {!!searchParams?.done &&    <div className="card" style={{ border:"1px solid rgba(59,130,246,.35)", background:"rgba(59,130,246,.08)", fontWeight:600 }}>✓ Séance terminée.</div>}
        {!!searchParams?.deleted && <div className="card" style={{ border:"1px solid rgba(239,68,68,.35)", background:"rgba(239,68,68,.08)", fontWeight:600 }}>Séance supprimée.</div>}
        {!!searchParams?.error &&   <div className="card" style={{ border:"1px solid rgba(239,68,68,.35)", background:"rgba(239,68,68,.08)", fontWeight:600 }}>⚠️ Erreur : {searchParams.error}</div>}
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
              <input className="input" type="text" name="title" placeholder="ex: Full body, Cardio 20', HIIT Tabata…" required />
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
            <div className="lg:col-span-3" style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button className="btn btn-dash" type="submit">Démarrer maintenant</button>
            </div>
          </form>
        </div>
      </div>

      {/* Mon programme (séances actives, générées depuis le Sheet) */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Mon programme (personnalisé par l’IA)</h2>
          <div className="flex items-center gap-2">
            <form action={startQuestionnaireAction}><button className="btn" type="submit" style={{ background:"#fff", border:"1px solid #d1d5db" }}>Remplir le questionnaire</button></form>
            <form action={buildProgramFromSheetAction}><button className="btn btn-dash" type="submit">Créer mon programme</button></form>
          </div>
        </div>

        {active.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>Aucune séance active pour l’instant. Remplis le questionnaire puis clique “Créer mon programme”.</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((s) => {
              const dur = s.startedAt ? minutesBetween(s.startedAt, new Date().toISOString()) : undefined;
              return (
                <article key={s.id} className="card" style={{ transition: "box-shadow .2s" }}>
                  <div className="flex items-start justify-between gap-3">
                    <strong style={{ fontSize: 16 }}>{s.title}</strong>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>{s.type}</span>
                  </div>
                  <div className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
                    Prévu le <b style={{ color: "inherit" }}>{fmtDateYMD(s.date)}</b>
                    {s.plannedMin ? ` · ${s.plannedMin} min prévues` : ""}
                    {s.startedAt ? (<><br/>Démarrée : <b style={{ color: "inherit" }}>{fmtDateISO(s.startedAt)}</b>{dur ? ` · ${dur} min` : ""}</>) : null}
                    {s.note ? (<><br/>Note : <i>{s.note}</i></>) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <form action={completeSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-dash" type="submit">Marquer terminé</button>
                    </form>
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn" type="submit" style={{ background:"#fff", color:"#111827", border:"1px solid #d1d5db", fontWeight:500 }}>Supprimer</button>
                    </form>
                  </div>
                </article>
              );
            })}
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
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>{s.type}</span>
                  </div>
                  <div className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
                    Le <b style={{ color: "inherit" }}>{fmtDateISO(s.endedAt)}</b>
                    {mins ? ` · ${mins} min` : ""}
                    {s.plannedMin ? ` (prévu ${s.plannedMin} min)` : ""}
                    {s.note ? (<><br/>Note : <i>{s.note}</i></>) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn" type="submit" style={{ background:"#fff", color:"#111827", border:"1px solid #d1d5db", fontWeight:500 }}>Supprimer</button>
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
