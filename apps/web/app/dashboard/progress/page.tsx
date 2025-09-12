// apps/web/app/dashboard/progress/page.tsx
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

type Store = {
  entries: ProgressEntry[];
};

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
export default async function Page({ searchParams }: { searchParams?: { success?: string; error?: string; deleted?: string } }) {
  const jar = cookies();
  const store = parseStore(jar.get("app_progress")?.value);

  // Dernières entrées triées par createdAt desc
  const recent = [...store.entries].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 12);

  // Dernières valeurs par type
  const lastByType: Record<EntryType, ProgressEntry | undefined> = {
    steps: store.entries.find(e => e.type === "steps"),
    load: store.entries.find(e => e.type === "load"),
    weight: store.entries.find(e => e.type === "weight"),
  };

  // Date par défaut (locale)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      {/* Bandeau */}
      <section className="section" style={{ marginTop: 0 }}>
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Mes progrès</h2>
            <div className="text-sm" style={{ marginTop: 6, color: "#6b7280" }}>
              Enregistrez vos pas, vos charges (kg) et votre poids. Vos entrées sont stockées en local (cookie).
            </div>
          </div>
          <a href="/dashboard" className="btn btn-outline">← Retour</a>
        </div>
      </section>

      {/* Messages */}
      {!!searchParams?.success && (
        <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", marginBottom: 12, fontWeight: 600 }}>
          ✓ Entrée enregistrée.
        </div>
      )}
      {!!searchParams?.deleted && (
        <div className="card" style={{ border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.08)", marginBottom: 12, fontWeight: 600 }}>
          Entrée supprimée.
        </div>
      )}
      {!!searchParams?.error && (
        <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", marginBottom: 12, fontWeight: 600 }}>
          ⚠️ Erreur : {searchParams.error}
        </div>
      )}

      {/* Saisie */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Ajouter une entrée</h2>
        </div>

        <form action={addProgressAction} className="grid gap-6 lg:grid-cols-3">
          {/* Type */}
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" defaultValue="steps" required>
              <option value="steps">Pas (steps)</option>
              <option value="load">Charges portées (kg)</option>
              <option value="weight">Poids (kg)</option>
            </select>
            <div className="text-xs" style={{ color: "#6b7280", marginTop: 6 }}>
              Pour <b>charges</b>, tu peux aussi saisir les <b>répétitions</b> plus bas.
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

          <div className="lg:col-span-3" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn btn-dash" type="submit">Enregistrer</button>
          </div>
        </form>
      </section>

      {/* Résumé dernier point par type */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Dernières valeurs</h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="card">
            <div className="flex items-center justify-between">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Pas</h3>
              <span className="badge">Steps</span>
            </div>
            {lastByType.steps ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{lastByType.steps.value.toLocaleString("fr-FR")} pas</div>
                <div className="text-sm" style={{ color: "#6b7280" }}>{fmtDate(lastByType.steps.date)}</div>
              </div>
            ) : (
              <div className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>Aucune donnée.</div>
            )}
          </article>

          <article className="card">
            <div className="flex items-center justify-between">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Charges</h3>
              <span className="badge">Load</span>
            </div>
            {lastByType.load ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  {lastByType.load.value} kg{lastByType.load.reps ? ` × ${lastByType.load.reps}` : ""}
                </div>
                <div className="text-sm" style={{ color: "#6b7280" }}>{fmtDate(lastByType.load.date)}</div>
              </div>
            ) : (
              <div className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>Aucune donnée.</div>
            )}
          </article>

          <article className="card">
            <div className="flex items-center justify-between">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Poids</h3>
              <span className="badge">Weight</span>
            </div>
            {lastByType.weight ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{lastByType.weight.value} kg</div>
                <div className="text-sm" style={{ color: "#6b7280" }}>{fmtDate(lastByType.weight.date)}</div>
              </div>
            ) : (
              <div className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>Aucune donnée.</div>
            )}
          </article>
        </div>
      </section>

      {/* Historique */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Entrées récentes</h2>
        </div>

        {recent.length === 0 ? (
          <div className="card">
            <div className="text-sm" style={{ color: "#6b7280" }}>
              Pas encore de données — commencez en ajoutant une entrée ci-dessus.
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((e) => (
              <article key={e.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="flex items-center justify-between">
                  <strong style={{ fontSize: 16 }}>
                    {e.type === "steps" && "Pas"}
                    {e.type === "load" && "Charges"}
                    {e.type === "weight" && "Poids"}
                  </strong>
                  <span className="badge">{fmtDate(e.date)}</span>
                </div>

                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {e.type === "steps" && `${e.value.toLocaleString("fr-FR")} pas`}
                  {e.type === "load" && `${e.value} kg${e.reps ? ` × ${e.reps}` : ""}`}
                  {e.type === "weight" && `${e.value} kg`}
                </div>

                {e.note && <div className="text-sm" style={{ color: "#6b7280" }}>{e.note}</div>}

                <form action={deleteEntryAction} style={{ marginTop: 4 }}>
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
