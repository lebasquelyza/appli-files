// app/dashboard/calories/page.tsx
import { cookies } from "next/headers";
import FoodSnap from "./FoodSnap";
import { saveCalories } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type KcalStore = Record<string, number>; // "YYYY-MM-DD" -> kcal
type NotesStore = Record<string, string>; // "YYYY-MM-DD" -> note (texte)

/* ---------- Utils ---------- */
const TZ = "Europe/Paris";
function todayISO(tz = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function parseKcalStore(raw?: string): KcalStore {
  try {
    const data = JSON.parse(raw || "{}");
    if (data && typeof data === "object") {
      const out: KcalStore = {};
      for (const [k, v] of Object.entries<any>(data)) {
        const n = Number(v);
        if (Number.isFinite(n)) out[k] = n;
      }
      return out;
    }
  } catch {}
  return {};
}

function parseNotesStore(raw?: string): NotesStore {
  try {
    const data = JSON.parse(raw || "{}");
    if (data && typeof data === "object") {
      const out: NotesStore = {};
      for (const [k, v] of Object.entries<any>(data)) {
        if (v != null) out[k] = String(v);
      }
      return out;
    }
  } catch {}
  return {};
}

/* ---------- Page ---------- */
export default async function Page({
  searchParams,
}: {
  searchParams?: { saved?: string; err?: string };
}) {
  const jar = cookies();
  const store = parseKcalStore(jar.get("app.kcals")?.value);
  const notes = parseNotesStore(jar.get("app.kcals.notes")?.value);

  const today = todayISO();
  const todayKcal = store[today] || 0;

  // Vue 14 jours
  const days: { date: string; kcal: number; note?: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
    days.push({ date, kcal: store[date] || 0, note: notes[date] });
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>Calories</h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            Enregistre tes calories consommées aujourd’hui. Historique sur 14 jours.
          </p>
        </div>
      </div>

      {searchParams?.saved && (
        <div
          id="saved"
          className="card"
          style={{ border: "1px solid #16a34a33", background: "#16a34a0d", marginBottom: 12 }}
        >
          <strong>Enregistré !</strong> Tes calories ont été mises à jour.
        </div>
      )}
      {searchParams?.err && (
        <div
          className="card"
          style={{ border: "1px solid #dc262633", background: "#dc26260d", marginBottom: 12 }}
        >
          <strong>Erreur</strong> :{" "}
          {searchParams.err === "bad_date" ? "date invalide." : "valeur de calories invalide."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="card">
          <h3 style={{ marginTop: 0, fontSize: 16, color: "#111827" }}>Aujourd’hui</h3>
          <div className="text-sm" style={{ color: "#6b7280", fontSize: 14 }}>
            {today}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              marginTop: 8,
              color: "#111827",
              lineHeight: 1,
            }}
          >
            {todayKcal.toLocaleString("fr-FR")} kcal
          </div>

          {/* Module photo + nutrition (détection IA : produit ou assiette, kcal + protéines) */}
          <div style={{ marginTop: 12 }}>
            <FoodSnap today={today} onSave={saveCalories} />
          </div>

          {/* Formulaire manuel si l’utilisateur veut saisir à la main */}
          <form action={saveCalories} style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input type="hidden" name="date" value={today} />
            <div>
              <label className="label">Calories à ajouter</label>
              <input
                className="input"
                type="number"
                name="kcal"
                min={0}
                step={1}
                placeholder="ex: 650"
                required
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  caretColor: "#111827",
                  WebkitTextFillColor: "#111827" as any,
                }}
              />
              <div className="text-xs" style={{ color: "#6b7280", marginTop: 4, fontSize: 12 }}>
                La valeur s’ajoute au total du jour (elle n’écrase pas).
              </div>
            </div>
            <div>
              <label className="label">Note (optionnel)</label>
              <input
                className="input"
                type="text"
                name="note"
                placeholder="ex: Déj: poke bowl"
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  caretColor: "#111827",
                  WebkitTextFillColor: "#111827" as any,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-dash" type="submit" style={{ fontSize: 14 }}>
                Enregistrer
              </button>
              <a
                href="/dashboard/calories"
                className="btn"
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  fontWeight: 500,
                  fontSize: 14,
                }}
              >
                Actualiser
              </a>
            </div>
          </form>
        </article>

        <article className="card">
          <details>
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>Historique (14 jours)</h3>
              <span className="text-sm" style={{ color: "#6b7280", fontSize: 14 }}>
                (cliquer pour afficher/masquer)
              </span>
            </summary>

            <div className="text-sm" style={{ color: "#6b7280", margin: "6px 0 6px", fontSize: 14 }}>
              Les jours sans saisie sont à 0 kcal.
            </div>

            <div className="table-wrapper" style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Date</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>kcal</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.date}>
                      <td style={{ padding: "6px 8px" }}>
                        {new Intl.DateTimeFormat("fr-FR", {
                          timeZone: TZ,
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                        }).format(new Date(d.date))}
                        <span style={{ color: "#6b7280", marginLeft: 6, fontSize: 12 }}>
                          ({d.date})
                        </span>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "tabular-nums" }}>
                        {d.kcal.toLocaleString("fr-FR")}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#374151" }}>
                        {d.note || <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
      </div>
    </div>
  );
}

