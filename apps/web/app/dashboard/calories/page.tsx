import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

function pruneStore(store: Record<string, unknown>, keepDays = 60) {
  const keys = Object.keys(store).sort(); // "YYYY-MM-DD"
  const toDrop = Math.max(0, keys.length - keepDays);
  for (let i = 0; i < toDrop; i++) delete (store as any)[keys[i]];
}

/* ---------- Server action: enregistre kcal ---------- */
async function saveCalories(formData: FormData) {
  "use server";
  const date = String(formData.get("date") || todayISO());
  const kcal = Number(formData.get("kcal"));
  const note = (formData.get("note") || "").toString().slice(0, 120);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/dashboard/calories?err=bad_date");
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 50000) redirect("/dashboard/calories?err=bad_kcal");

  const jar = cookies();
  const store = parseKcalStore(jar.get("app.kcals")?.value);

  // on cumule au jour
  store[date] = (store[date] || 0) + Math.round(kcal);
  pruneStore(store, 60);

  jar.set("app.kcals", JSON.stringify(store), {
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  });

  if (note) {
    const notes = parseNotesStore(jar.get("app.kcals.notes")?.value);
    notes[date] = note; // <-- string dans un store string ✅
    pruneStore(notes, 60);
    jar.set("app.kcals.notes", JSON.stringify(notes), {
      path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
    });
  }

  redirect("/dashboard/calories?saved=1#saved");
}

/* ---------- Page ---------- */
export default async function Page({ searchParams }: { searchParams?: { saved?: string; err?: string } }) {
  const jar = cookies();
  const store = parseKcalStore(jar.get("app.kcals")?.value);
  const notes = parseNotesStore(jar.get("app.kcals.notes")?.value);

  const today = todayISO();
  const todayKcal = store[today] || 0;

  // Vue 14 jours
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
      onClick={(e) => {
        // empêche le double focus sur certains navigateurs
        (e.currentTarget as HTMLDetailsElement).blur?.();
      }}
    >
      <h3 style={{ margin: 0 }}>Historique (14 jours)</h3>
      <span className="text-sm" style={{ color: "#6b7280" }}>
        (cliquer pour afficher/masquer)
      </span>
    </summary>

    <div className="text-sm" style={{ color: "#6b7280", margin: "6px 0 6px" }}>
      Les jours sans saisie sont à 0 kcal.
    </div>

    <div className="table-wrapper" style={{ overflowX: "auto" }}>
      <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
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
                {new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(d.date))}
                <span style={{ color: "#6b7280", marginLeft: 6, fontSize: 12 }}>({d.date})</span>
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
