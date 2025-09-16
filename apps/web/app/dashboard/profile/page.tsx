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

// ===== Server Actions (non exportées) =====
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

  jar.set("app_sessions", JSON.stringify(next), {
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
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
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
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
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  });

  redirect("/dashboard/profile?deleted=1");
}

// ===== Page =====
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      {/* Header */}
      <section className="mb-6">
        <div className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Mon profil</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Gérez vos séances et gardez un historique clair de votre entraînement.
              </p>
            </div>
          <a href="/dashboard" className="btn btn-outline text-black">
  ← Retour
</a>


          </div>
       </div>
      </section>

      {/* Alerts */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            ✓ Séance ajoutée.
          </div>
        )}
        {!!searchParams?.done && (
          <div className="rounded-xl border border-sky-300/60 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
            ✓ Séance terminée.
          </div>
        )}
        {!!searchParams?.deleted && (
          <div className="rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            Séance supprimée.
          </div>
        )}
        {!!searchParams?.error && (
          <div className="rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            ⚠️ Erreur : {searchParams.error}
          </div>
        )}
      </div>

      {/* Ajouter une séance */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Ajouter une séance</h2>
        </div>

        <div className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
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
            <div className="lg:col-span-3 flex justify-end gap-3">
              <button className="btn btn-dash" type="submit">Démarrer maintenant</button>
            </div>
          </form>
        </div>
      </section>

      {/* Mes séances en cours */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Mes séances en cours</h2>
        </div>

        {active.length === 0 ? (
          <div className="rounded-2xl border bg-white/60 p-5 text-sm text-muted-foreground shadow-sm backdrop-blur dark:bg-black/40">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">💤</span>
              <span>Aucune séance en cours.</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((s) => {
              const dur = minutesBetween(s.startedAt, new Date().toISOString());
              return (
                <article key={s.id} className="group rounded-2xl border bg-white/60 p-5 shadow-sm transition hover:shadow-md backdrop-blur dark:bg-black/40">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-base">{s.title}</strong>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                      {s.type}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Prévu le <b className="text-foreground">{fmtDateYMD(s.date)}</b>
                    {s.plannedMin ? ` · ${s.plannedMin} min prévues` : ""}
                    <br />
                    Démarrée : <b className="text-foreground">{fmtDateISO(s.startedAt || s.createdAt)}</b>
                    {dur ? ` · ${dur} min` : ""}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <form action={completeSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-dash" type="submit">Marquer terminé</button>
                    </form>
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-outline" type="submit">Supprimer</button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Mes séances passées */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Mes séances passées</h2>
          {past.length > 12 && (
            <span className="text-xs text-muted-foreground">Affichage des 12 dernières</span>
          )}
        </div>

        {past.length === 0 ? (
          <div className="rounded-2xl border bg-white/60 p-5 text-sm text-muted-foreground shadow-sm backdrop-blur dark:bg-black/40">
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
                <article key={s.id} className="group rounded-2xl border bg-white/60 p-5 shadow-sm transition hover:shadow-md backdrop-blur dark:bg-black/40">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-base">{s.title}</strong>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type)}`}>
                      {s.type}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground">
                    Le <b className="text-foreground">{fmtDateISO(s.endedAt)}</b>
                    {mins ? ` · ${mins} min` : ""}
                    {s.plannedMin ? ` (prévu ${s.plannedMin} min)` : ""}
                    {s.note ? (
                      <>
                        <br />
                        Note : <i>{s.note}</i>
                      </>
                    ) : null}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-outline" type="submit">Supprimer</button>
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
