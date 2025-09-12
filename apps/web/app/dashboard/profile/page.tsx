// apps/web/app/dashboard/profile/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
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
    const [y,m,d] = ymd.split("-").map(Number);
    const dt = new Date(y,(m||1)-1,d||1);
    return dt.toLocaleDateString("fr-FR", { year:"numeric", month:"long", day:"numeric" });
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

/* ========= Server Actions ========= */

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
    type: (["muscu","cardio","hiit","mobilité"].includes(type) ? type : "muscu") as WorkoutType,
    status: "active",
    date,
    plannedMin: plannedMinStr ? Number(plannedMinStr) : undefined,
    startedAt: startNow ? new Date().toISOString() : undefined,
    note: note || undefined,
    createdAt: new Date().toISOString(),
  };

  const next: Store = { sessions: [w, ...store.sessions].slice(0, 300) };

  jar.set("app_sessions", JSON.stringify(next), {
    path: "/", sameSite: "lax", maxAge: 60*60*24*365, httpOnly: false,
  });

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

  jar.set("app_sessions", JSON.stringify({ sessions }), {
    path: "/", sameSite: "lax", maxAge: 60*60*24*365, httpOnly: false,
  });

  redirect("/dashboard/profile?done=1");
}

async function deleteSessionAction(formData: FormData) {
  "use server";
  const id = (formData.get("id") || "").toString();
  if (!id) redirect("/dashboard/profile");

  const jar = cookies();
  const store = parseStore(jar.get("app_sessions")?.value);
  const sessions = store.sessions.filter(s => s.id !== id);

  jar.set("app_sessions", JSON.stringify({ sessions }), {
    path: "/", sameSite: "lax", maxAge: 60*60*24*365, httpOnly: false,
  });

  redirect("/dashboard/profile?deleted=1");
}

/* ========= Page ========= */

export default async function Page({ searchParams }: { searchParams?: { success?: string; error?: string; done?: string; deleted?: string } }) {
  // session app (si tu affiches d’autres infos de profil plus tard)
  let sess: any = {};
  try { sess = await getSession(); } catch {}

  const jar = cookies();
  const store = parseStore(jar.get("app_sessions")?.value);

  const active = store.sessions
    .filter(s => s.status === "active")
    .sort((a,b) => (b.startedAt || b.createdAt || "").localeCompare(a.startedAt || a.createdAt || ""));

  const past = store.sessions
    .filter(s => s.status === "done")
    .sort((a,b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  const defaultDate = toYMD();

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:32 }}>
      {/* Bandeau profil */}
      <section className="section" style={{ marginTop:0 }}>
        <div className="card" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>Mon profil</h2>
            <div className="text-sm" style={{ marginTop:6, color:"#6b7280" }}>
              Gérez vos séances et gardez un historique clair de votre entraînement.
            </div>
          </div>
          <a href="/dashboard" className="btn btn-outline" style={{ color:"#111" }}>← Retour</a>
        </div>
      </section>

      {/* Alerts */}
      {!!searchParams?.success && (
        <div className="card" style={{ border:"1px solid rgba(16,185,129,.35)", background:"rgba(16,185,129,.08)", marginBottom:12, fontWeight:600 }}>
          ✓ Séance ajoutée.
        </div>
      )}
      {!!searchParams?.done && (
        <div className="card" style={{ border:"1px solid rgba(59,130,246,.35)", background:"rgba(59,130,246,.08)", marginBottom:12, fontWeight:600 }}>
          ✓ Séance terminée.
        </div>
      )}
      {!!searchParams?.deleted && (
        <div className="card" style={{ border:"1px solid rgba(239,68,68,.35)", background:"rgba(239,68,68,.08)", marginBottom:12, fontWeight:600 }}>
          Séance supprimée.
        </div>
      )}
      {!!searchParams?.error && (
        <div className="card" style={{ border:"1px solid rgba(239,68,68,.35)", background:"rgba(239,68,68,.08)", marginBottom:12, fontWeight:600 }}>
          ⚠️ Erreur : {searchParams.error}
        </div>
      )}

      {/* Ajouter une séance */}
      <section className="section" style={{ marginTop:12 }}>
        <div className="section-head" style={{ marginBottom:8 }}>
          <h2 style={{ margin:0 }}>Ajouter une séance</h2>
        </div>

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
            <input className="input" type="number" name="plannedMin" placeholder="ex: 30" />
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
      </section>

      {/* Mes séances en cours */}
      <section className="section" style={{ marginTop:12 }}>
        <div className="section-head" style={{ marginBottom:8 }}>
          <h2 style={{ margin:0 }}>Mes séances en cours</h2>
        </div>

        {active.length === 0 ? (
          <div className="card">
            <div className="text-sm" style={{ color:"#6b7280" }}>Aucune séance en cours.</div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map(s => {
              const dur = minutesBetween(s.startedAt, new Date().toISOString());
              return (
                <article key={s.id} className="card" style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <div className="flex items-center justify-between">
                    <strong style={{ fontSize:16 }}>{s.title}</strong>
                    <span className="badge" title="Type">{s.type}</span>
                  </div>
                  <div className="text-sm" style={{ color:"#6b7280" }}>
                    Prévu le <b>{fmtDateYMD(s.date)}</b>{s.plannedMin ? ` · ${s.plannedMin} min prévues` : ""}<br/>
                    Démarrée : <b>{fmtDateISO(s.startedAt || s.createdAt)}</b>{dur ? ` · ${dur} min` : ""}
                  </div>

                  <div style={{ display:"flex", gap:8, marginTop:6 }}>
                    <form action={completeSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-dash" type="submit">Marquer terminé</button>
                    </form>
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-outline" type="submit" style={{ color:"#111" }}>Supprimer</button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Mes séances passées */}
      <section className="section" style={{ marginTop:12 }}>
        <div className="section-head" style={{ marginBottom:8 }}>
          <h2 style={{ margin:0 }}>Mes séances passées</h2>
        </div>

        {past.length === 0 ? (
          <div className="card">
            <div

