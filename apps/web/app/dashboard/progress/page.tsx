import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type EntryType = "steps" | "load" | "weight";

type ProgressEntry = {
  id: string;
  type: EntryType;
  date: string;      // YYYY-MM-DD
  value: number;     // pas / kg
  reps?: number;     // seulement pour "load"
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

/* ====== Helpers semaine (lundi → dimanche) ====== */
function startOfWeekMonday(d: Date) {
  const ld = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = ld.getDay(); // 0=Dim..6=Sam
  const diffSinceMonday = (day + 6) % 7; // Lundi=0
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

function entryBadgeStyles(t: EntryType): React.CSSProperties {
  switch (t) {
    case "steps":
      return { border: "1px solid rgba(14,165,233,.25)", background: "rgba(14,165,233,.08)", color: "#0369a1" };
    case "load":
      return { border: "1px solid rgba(245,158,11,.25)", background: "rgba(245,158,11,.08)", color: "#92400e" };
    case "weight":
      return { border: "1px solid rgba(139,92,246,.25)", background: "rgba(139,92,246,.08)", color: "#5b21b6" };
  }
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

  const next: Store = { entries: [entry, ...store.entries].slice(0, 400) };

  jar.set("app_progress", JSON.stringify(next), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
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
  const next: Store = { entries: store.entries.filter(e => e.id !== id) };

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
}: { searchParams?: { success?: string; error?: string; deleted?: string } }) {
  const jar = cookies();
  const store = parseStore(jar.get("app_progress")?.value);

  const recent = [...store.entries]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 12);

  const lastByType: Record<EntryType, ProgressEntry | undefined> = {
    steps: store.entries.find(e => e.type === "steps"),
    load: store.entries.find(e => e.type === "load"),
    weight: store.entries.find(e => e.type === "weight"),
  };

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  // Semaine en cours
  const monday = startOfWeekMonday(today);
  const sunday = endOfWeekFromMonday(monday);
  const mondayYMD = toYMD(monday);
  const sundayYMD = toYMD(sunday);

  const stepsThisWeek = store.entries
    .filter(e => e.type === "steps")
    .filter(e => {
      const d = parseYMDLocal(e.date);
      return d >= monday && d <= sunday;
    })
    .reduce((sum, e) => sum + (Number(e.value) || 0), 0);

  const daysCovered = new Set(
    store.entries
      .filter(e => e.type === "steps")
      .filter(e => {
        const d = parseYMDLocal(e.date);
        return d >= monday && d <= sunday;
      })
      .map(e => e.date)
  ).size;

  const avgPerDay = daysCovered > 0 ? Math.round(stepsThisWeek / daysCovered) : 0;
  const hasWeekData = stepsThisWeek > 0 && daysCovered > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      {/* Header */}
      <section className="mb-6">
        <div className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Mes progrès</h1>
              <p className="mt-1 text-sm" style={{ color: "#6b7280" }}>
                Enregistrez vos pas, vos charges et votre poids. Les données sont stockées localement.
              </p>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center rounded-md border px-3 py-1 text-sm"
              style={{ color: "#111", borderColor: "rgba(0,0,0,.15)" }}
            >
              ← Retour
            </a>
          </div>
        </div>
      </section>

      {/* Messages */}
      <div className="space-y-3">
        {!!searchParams?.success && (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm font-medium" style={{ color: "#065f46" }}>
            ✓ Entrée enregistrée.
          </div>
        )}
        {!!searchParams?.deleted && (
          <div className="rounded-xl border border-sky-300/60 bg-sky-50 px-4 py-3 text-sm font-medium" style={{ color: "#075985" }}>
            Entrée supprimée.
          </div>
        )}
        {!!searchParams?.error && (
          <div className="rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm font-medium" style={{ color: "#9f1239" }}>
            ⚠️ Erreur : {searchParams.error}
          </div>
        )}
      </div>

      {/* 1) Formulaire d'abord */}
      <section className="mt-8">
        <div className="rounded-2xl border bg-white/60 p-5 shadow-sm backdrop-blur dark:bg-black/40">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Ajouter une entrée</h2>
          </div>

          <form action={addProgressAction} className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="steps" required>
                <option value="steps">Pas (steps)</option>
                <option value="load">Charges portées (kg)</option>
                <option value="weight">Poids (kg)</option>
              </select>
              <div className="text-xs" style={{ color: "#6b7280", marginTop: 6 }}>
                Pour <b>charges</b>, vous pouvez renseigner les <b>répétitions</b> ci-dessous.
              </div>
            </div>

            <div>
              <label className="label">Date</label>
              <input className="input" type="date" name="date" required defaultValue={defaultDate} />
            </div>

            <div>
              <label className="label">Valeur</label>
              <input className="input" type="number" name="value" step="any" placeholder="ex: 8000 (pas) / 60 (kg)" required />
            </div>

            <div>
              <label className="label">Répétitions (optionnel, charges)</label>
              <input className="input" type="number" name="reps" step="1" placeholder="ex: 8" />
            </div>

            <div className="lg:col-span-2">
              <label className="label">Note (optionnel)</label>
              <input className="input" type="text" name="note" placeholder="ex: Marche rapide, Squat barre, etc." />
            </div>

            <div className="lg:col-span-3" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-dash" type="submit">Enregistrer</button>
            </div>
          </form>
        </div>
      </section>

      {/* 2) Grand bloc blanc arrondi, en bas de page */}
      <section className="mt-8">
        <div
          className="rounded-3xl border shadow-sm"
          style={{ background: "#fff", overflow: "hidden" }}
        >
          {/* Bandeau doux */}
          <div
            style={{
              height: 10,
              background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02))",
            }}
          />
          <div style={{ padding: 20 }}>
            {/* Pas — semaine en cours */}
            <div className="mb-6">
              <div
                style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <h2 style={{ margin: 0 }}>Pas — semaine en cours</h2>
                <span className="text-xs" style={{ color: "#6b7280" }}>Semaine = lundi → dimanche</span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 260 }}>
                  <div className="text-sm" style={{ color: "#6b7280" }}>
                    Du <b>{fmtDate(mondayYMD)}</b> au <b>{fmtDate(sundayYMD)}</b>
                  </div>

                  {hasWeekData ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 12,
                        marginTop: 12,
                      }}
                    >
                      <div className="rounded-xl border" style={{ padding: 12, background: "#fff" }}>
                        <div className="text-sm" style={{ color: "#6b7280" }}>Total</div>
                        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
                          {stepsThisWeek.toLocaleString("fr-FR")}
                        </div>
                        <div className="text-xs" style={{ color: "#6b7280" }}>pas</div>
                      </div>
                      <div className="rounded-xl border" style={{ padding: 12, background: "#fff" }}>
                        <div className="text-sm" style={{ color: "#6b7280" }}>Jours saisis</div>
                        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
                          {daysCovered}
                        </div>
                        <div className="text-xs" style={{ color: "#6b7280" }}>sur 7</div>
                      </div>
                      <div className="rounded-xl border" style={{ padding: 12, background: "#fff" }}>
                        <div className="text-sm" style={{ color: "#6b7280" }}>Moyenne / jour</div>
                        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
                          {avgPerDay.toLocaleString("fr-FR")}
                        </div>
                        <div className="text-xs" style={{ color: "#6b7280" }}>pas/jour</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "#6b7280", marginTop: 10 }}>
                      Aucune donnée saisie pour cette semaine. Ajoutez une entrée ci-dessus pour voir vos stats.
                    </div>
                  )}
                </div>

                <div className="text-xs" style={{ color: "#6b7280" }}>Semaine locale FR</div>
              </div>
            </div>

            <hr style={{ borderColor: "rgba(0,0,0,.08)", margin: "16px 0" }} />

            {/* Dernières valeurs */}
            <div className="mb-6">
              <h2 style={{ margin: 0, marginBottom: 8 }}>Dernières valeurs</h2>
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-xl border" style={{ padding: 16, background: "#fff" }}>
                  <div className="flex items-center justify-between">
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Pas</h3>
                    <span className="badge">Steps</span>
                  </div>
                  {lastByType.steps ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>
                        {lastByType.steps.value.toLocaleString("fr-FR")} pas
                      </div>
                      <div className="text-sm" style={{ color: "#6b7280" }}>
                        {fmtDate(lastByType.steps.date)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>Aucune donnée.</div>
                  )}
                </div>

                <div className="rounded-xl border" style={{ padding: 16, background: "#fff" }}>
                  <div className="flex items-center justify-between">
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Charges</h3>
                    <span className="badge">Load</span>
                  </div>
                  {lastByType.load ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>
                        {lastByType.load.value} kg{lastByType.load.reps ? ` × ${lastByType.load.reps}` : ""}
                      </div>
                      <div className="text-sm" style={{ color: "#6b7280" }}>
                        {fmtDate(lastByType.load.date)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>Aucune donnée.</div>
                  )}
                </div>

                <div className="rounded-xl border" style={{ padding: 16, background: "#fff" }}>
                  <div className="flex items-center justify-between">
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Poids</h3>
                    <span className="badge">Weight</span>
                  </div>
                  {lastByType.weight ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>
                        {lastByType.weight.value} kg
                      </div>
                      <div className="text-sm" style={{ color: "#6b7280" }}>
                        {fmtDate(lastByType.weight.date)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>Aucune donnée.</div>
                  )}
                </div>
              </div>
            </div>

            <hr style={{ borderColor: "rgba(0,0,0,.08)", margin: "16px 0" }} />

            {/* Entrées récentes */}
            <div>
              <h2 style={{ margin: 0, marginBottom: 8 }}>Entrées récentes</h2>

              {recent.length === 0 ? (
                <div
                  className="rounded-xl border"
                  style={{ padding: 16, background: "#fff", color: "#6b7280", fontSize: 14 }}
                >
                  Pas encore de données — commencez en ajoutant une entrée ci-dessus.
                </div>
              ) : (
                <div className="space-y-3">
                  {recent.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-xl border"
                      style={{
                        background: "#fff",
                        padding: 12,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs"
                          style={{
                            ...entryBadgeStyles(e.type),
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {e.type === "steps" && "Pas"}
                          {e.type === "load" && "Charges"}
                          {e.type === "weight" && "Poids"}
                        </span>

                        <div style={{ minWidth: 0 }}>
                          <div className="text-sm" style={{ color: "#6b7280" }}>
                            {fmtDate(e.date)}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>
                            {e.type === "steps" && `${e.value.toLocaleString("fr-FR")} pas`}
                            {e.type === "load" && `${e.value} kg${e.reps ? ` × ${e.reps}` : ""}`}
                            {e.type === "weight" && `${e.value} kg`}
                          </div>
                          {e.note && (
                            <div className="text-sm" style={{ color: "#6b7280", marginTop: 2 }}>
                              {e.note}
                            </div>
                          )}
                        </div>
                      </div>

                      <form action={deleteEntryAction} style={{ flexShrink: 0 }}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs"
                          style={{ borderColor: "rgba(0,0,0,.15)" }}
                        >
                          Supprimer
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
