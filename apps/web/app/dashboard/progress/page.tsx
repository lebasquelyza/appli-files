import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type EntryType = "steps" | "load" | "weight";

type ProgressEntry = {
  id: string;
  type: EntryType;
  date: string; // YYYY-MM-DD
  value: number; // pas / kg
  reps?: number; // seulement pour "load"
  note?: string;
  createdAt: string; // ISO
};

type Store = { entries: ProgressEntry[] };

function parseStore(val?: string | null): Store {
  if (!val) return { entries: [] };
  try {
    const obj = JSON.parse(val);
    if (Array.isArray(obj?.entries)) return { entries: obj.entries as ProgressEntry[] };
    return { entries: [] };
  } catch {
    return { entries: [] };
  }
}

function fmtDate(dateISO: string) {
  try {
    const d = new Date(dateISO);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
    }
  } catch {}
  return dateISO;
}

function uid() {
  return "id-" + Math.random().toString(36).slice(2, 10);
}

/* ====== Helpers "semaine en cours" (lundi → dimanche) ====== */
function startOfWeekMonday(d: Date) {
  const ld = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = ld.getDay(); // 0=Dim..6=Sam
  const diffSinceMonday = (day + 6) % 7; // Lundi=0, Dimanche=6
  ld.setDate(ld.getDate() - diffSinceMonday);
  return ld;
}
function endOfWeekFromMonday(monday: Date) {
  const s = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  s.setDate(s.getDate() + 6);
  return s;
}
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function parseYMDLocal(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** ------ Server Actions ------ */
async function addProgressAction(formData: FormData) {
  "use server";
  const type = (formData.get("type") || "").toString() as EntryType;
  const date = (formData.get("date") || "").toString();
  const valueStr = (formData.get("value") || "").toString().replace(",", ".");
  const repsStr = (formData.get("reps") || "").toString().replace(",", ".");
  const note = (formData.get("note") || "").toString().slice(0, 240);

  if (!["steps", "load", "weight"].includes(type)) redirect("/dashboard/progress?error=type");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/dashboard/progress?error=date");

  const value = Number(valueStr);
  const reps = repsStr ? Number(repsStr) : undefined;
  if (!isFinite(value) || value <= 0) redirect("/dashboard/progress?error=valeur");

  const jar = cookies();
  const store = parseStore(jar.get("app_progress")?.value);

  const entry: ProgressEntry = {
    id: uid(),
    type,
    date,
    value,
    reps: type === "load" && isFinite(Number(reps)) && Number(reps) > 0 ? Number(reps) : undefined,
    note: note || undefined,
    createdAt: new Date().toISOString(),
  };

  // garde au max 400 entrées pour éviter un cookie trop gros
  const next: Store = { entries: [entry, ...store.entries].slice(0, 400) };

  jar.set("app_progress", JSON.stringify(next), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 an
    httpOnly: false,
  });

  redirect("/dashboard/progress?success=1");
}

async function deleteEntryAction(formData: FormData) {
  "use server";
  const id = (formData.get("id") || "").toString();
  if (!id) redirect("/dashboard/progress");

  const jar = cookies();
  const store = parseStore(jar.get("app_progress")?.value);
  const next: Store = { entries: store.entries.filter((e) => e.id !== id) };

  jar.set("app_progress", JSON.stringify(next), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });

  redirect("/dashboard/progress?deleted=1");
}

/** ------ Page ------ */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; deleted?: string };
}) {
  const jar = cookies();
  const store = parseStore(jar.get("app_progress")?.value);

  // Dernières entrées triées par createdAt desc
  const recent = [...store.entries]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 12);

  // Dernières valeurs par type (naïf)
  const lastByType: Record<EntryType, ProgressEntry | undefined> = {
    steps: store.entries.find((e) => e.type === "steps"),
    load: store.entries.find((e) => e.type === "load"),
    weight: store.entries.find((e) => e.type === "weight"),
  };

  // Date par défaut (locale)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  // ====== Calcul "Pas — semaine en cours" ======
  const monday = startOfWeekMonday(today);
  const sunday = endOfWeekFromMonday(monday);
  const mondayYMD = toYMD(monday);
  const sundayYMD = toYMD(sunday);

  const stepsThisWeek = store.entries
    .filter((e) => e.type === "steps")
    .filter((e) => {
      const d = parseYMDLocal(e.date);
      return d >= monday && d <= sunday;
    })
    .reduce((sum, e) => sum + (Number(e.value) || 0), 0);

  const daysCovered = new Set(
    store.entries
      .filter((e) => e.type === "steps")
      .filter((e) => {
        const d = parseYMDLocal(e.date);
        return d >= monday && d <= sunday;
      })
      .map((e) => e.date)
  ).size;

  const avgPerDay = daysCovered > 0 ? Math.round(stepsThisWeek / daysCovered) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      {/* Header */}
      <section className="mb-6">
        <div className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Mes progrès</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enregistrez vos pas, vos charges et votre poids. Les données sont stockées localement.
              </p>
            </div>
            {/* Bouton retour compact */}
            <a
              href="/dashboard"
              className="inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium !text-black dark:!text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ← Retour
            </a>
          </div>
        </div>
      </section>

      {/* Messages */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            ✓ Entrée enregistrée.
          </div>
        )}
        {!!searchParams?.deleted && (
          <div className="rounded-xl border border-sky-300/60 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
            Entrée supprimée.
          </div>
        )}
        {!!searchParams?.error && (
          <div className="rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            ⚠️ Erreur : {searchParams.error}
          </div>
        )}
      </div>

      {/* Saisie */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Ajouter une entrée</h2>
        </div>

        <div className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
          <form action={addProgressAction} className="grid gap-6 lg:grid-cols-3">
            {/* Type */}
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="steps" required>
                <option value="steps">Pas (steps)</option>
                <option value="load">Charges portées (kg)</option>
                <option value="weight">Poids (kg)</option>
              </select>
              <div className="mt-1 text-xs text-muted-foreground">
                Pour <b>charges</b>, vous pouvez saisir les <b>répétitions</b> ci‑dessous.
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" name="date" required defaultValue={defaultDate} />
            </div>

            {/* Valeur principale */}
            <div>
              <label className="label">Valeur</label>
              <input className="input" type="number" name="value" step="any" placeholder="ex: 8000 (pas) / 60 (kg)" required />
            </div>

            {/* Répétitions (optionnel) */}
            <div>
              <label className="label">Répétitions (optionnel, charges)</label>
              <input className="input" type="number" name="reps" step="1" placeholder="ex: 8" />
            </div>

            {/* Note (optionnel) */}
            <div className="lg:col-span-2">
              <label className="label">Note (optionnel)</label>
              <input className="input" type="text" name="note" placeholder="ex: Marche rapide, Squat barre, etc." />
            </div>

            <div className="lg:col-span-3 flex justify-end gap-3">
              <button className="btn btn-dash" type="submit">Enregistrer</button>
            </div>
          </form>
        </div>
      </section>

      {/* Steps semaine en cours */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Pas — semaine en cours</h2>
          <span className="text-xs text-muted-foreground">Semaine = lundi → dimanche</span>
        </div>
        <article className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">
                Du <b className="text-foreground">{fmtDate(mondayYMD)}</b> au <b className="text-foreground">{fmtDate(sundayYMD)}</b>
              </div>
              <div className="mt-1 text-3xl font-extrabold">
                {stepsThisWeek.toLocaleString("fr-FR")} pas
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Moyenne sur {daysCovered || 0} jour(s) saisi(s) : <b className="text-foreground">{avgPerDay.toLocaleString("fr-FR")} pas/jour</b>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Semaine locale FR</div>
          </div>
        </article>
      </section>

      {/* Dernières valeurs */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Dernières valeurs</h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Pas</h3>
              <span className="badge">Steps</span>
            </div>
            {lastByType.steps ? (
              <div className="mt-2">
                <div className="text-2xl font-extrabold">{lastByType.steps.value.toLocaleString("fr-FR")} pas</div>
                <div className="text-sm text-muted-foreground">{fmtDate(lastByType.steps.date)}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">Aucune donnée.</div>
            )}
          </article>

          <article className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Charges</h3>
              <span className="badge">Load</span>
            </div>
            {lastByType.load ? (
              <div className="mt-2">
                <div className="text-2xl font-extrabold">
                  {lastByType.load.value} kg{lastByType.load.reps ? ` × ${lastByType.load.reps}` : ""}
                </div>
                <div className="text-sm text-muted-foreground">{fmtDate(lastByType.load.date)}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">Aucune donnée.</div>
            )}
          </article>

          <article className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Poids</h3>
              <span className="badge">Weight</span>
            </div>
            {lastByType.weight ? (
              <div className="mt-2">
                <div className="text-2xl font-extrabold">{lastByType.weight.value} kg</div>
                <div className="text-sm text-muted-foreground">{fmtDate(lastByType.weight.date)}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">Aucune donnée.</div>
            )}
          </article>
        </div>
      </section>

      {/* Historique */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Entrées récentes</h2>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-2xl border bg-white/60 p-5 text-sm text-muted-foreground shadow-sm backdrop-blur dark:bg-black/40">
            Pas encore de données — commencez en ajoutant une entrée ci‑dessus.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((e) => (
              <article key={e.id} className="group rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur transition hover:shadow-md dark:bg-black/40">
                <div className="flex items-center justify-between">
                  <strong className="text-base">
                    {e.type === "steps" && "Pas"}
                    {e.type === "load" && "Charges"}
                    {e.type === "weight" && "Poids"}
                  </strong>
                  <span className="badge">{fmtDate(e.date)}</span>
                </div>

                <div className="mt-2 text-lg font-extrabold">
                  {e.type === "steps" && `${e.value.toLocaleString("fr-FR")} pas`}
                  {e.type === "load" && `${e.value} kg${e.reps ? ` × ${e.reps}` : ""}`}
                  {e.type === "weight" && `${e.value} kg`}
                </div>

                {e.note && <div className="mt-1 text-sm text-muted-foreground">{e.note}</div>}

                <form action={deleteEntryAction} className="mt-3">
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn btn-outline" type="submit">Supprimer</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
