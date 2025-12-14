// apps/web/app/dashboard/calories/page.tsx
import { cookies } from "next/headers";
import FoodSnap from "./FoodSnap";
import { saveCalories } from "./actions";
import { translations } from "@/app/i18n/translations"; // ✅ i18n

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ========== i18n helpers (server) ========== */
type Lang = "fr" | "en";

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function tServer(lang: Lang, path: string, fallback?: string): string {
  const dict = translations[lang] as any;
  const v = getFromPath(dict, path);
  if (typeof v === "string") return v;
  return fallback ?? path;
}

function getLang(): Lang {
  const cookieLang = cookies().get("fc-lang")?.value;
  if (cookieLang === "en") return "en";
  return "fr";
}

/* ========== Types & helpers ========== */
type KcalStore = Record<string, number>;
type NotesStore = Record<string, string>;

const TZ = "Europe/Paris";
function todayISO(tz = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}
function parseKcalStore(raw?: string): KcalStore {
  try {
    const data = JSON.parse(raw || "{}");
    const out: KcalStore = {};
    for (const [k, v] of Object.entries<any>(data || {})) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}
function parseNotesStore(raw?: string): NotesStore {
  try {
    const data = JSON.parse(raw || "{}");
    const out: NotesStore = {};
    for (const [k, v] of Object.entries<any>(data || {})) {
      if (v != null) out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

export default async function Page() {
  const lang = getLang();
  const t = (path: string, fallback?: string) => tServer(lang, path, fallback);

  const jar = cookies();
  const store = parseKcalStore(jar.get("app.kcals")?.value);
  const notes = parseNotesStore(jar.get("app.kcals.notes")?.value);

  const today = todayISO();
  const todayKcal = store[today] || 0;

  // Liste des 14 derniers jours
  const days: { date: string; kcal: number; note?: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
    days.push({ date, kcal: store[date] || 0, note: notes[date] });
  }

  // ✅ Wrapper compatible <form action=...> (retourne Promise<void>)
  async function saveCaloriesAction(formData: FormData): Promise<void> {
    "use server";
    await saveCalories(formData);
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>
            {t("calories.page.title", "Calories")}
          </h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            {t(
              "calories.page.subtitle",
              "Enregistre tes calories consommées aujourd’hui. Historique sur 14 jours."
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Colonne 1 : Aujourd’hui + formulaire principal */}
        <article className="card">
          <h3 style={{ marginTop: 0, fontSize: 16, color: "#111827" }}>
            {t("calories.today.title", "Aujourd’hui")}
          </h3>
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
            {todayKcal.toLocaleString("fr-FR")} {t("calories.today.unit", "kcal")}
          </div>

          <form action={saveCaloriesAction} style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input type="hidden" name="date" value={today} />
            <div>
              <label className="label">{t("calories.form.kcal.label", "Calories à ajouter")}</label>
              <input
                className="input"
                type="number"
                name="kcal"
                min={0}
                step={1}
                placeholder={t("calories.form.kcal.placeholder", "ex: 650")}
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
                {t("calories.form.kcal.helper", "La valeur s’ajoute au total du jour (elle n’écrase pas).")}
              </div>
            </div>

            <div>
              <label className="label">{t("calories.form.note.label", "Note (optionnel)")}</label>
              <input
                className="input"
                type="text"
                name="note"
                placeholder={t("calories.form.note.placeholder", "ex: Déj: poke bowl")}
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
                {t("calories.form.buttons.save", "Enregistrer")}
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
                {t("calories.form.buttons.refresh", "Actualiser")}
              </a>
            </div>
          </form>
        </article>

        {/* Colonne 2 : Ajout via photo / code-barres / recherche */}
        <article className="card">
          <FoodSnap today={today} onSave={saveCalories} />
        </article>
      </div>

      {/* Historique 14 jours */}
      <div className="card" style={{ marginTop: 16 }}>
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
            <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>
              {t("calories.history.title", "Historique (14 jours)")}
            </h3>
            <span className="text-sm" style={{ color: "#6b7280", fontSize: 14 }}>
              {t("calories.history.toggle", "(cliquer pour afficher/masquer)")}
            </span>
          </summary>

          <div className="text-sm" style={{ color: "#6b7280", margin: "6px 0 6px", fontSize: 14 }}>
            {t("calories.history.helper", "Les jours sans saisie sont à 0 kcal.")}
          </div>

          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table
              className="table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>
                    {t("calories.history.headers.date", "Date")}
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    {t("calories.history.headers.kcal", "kcal")}
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>
                    {t("calories.history.headers.note", "Note")}
                  </th>
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
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        fontFamily: "tabular-nums",
                      }}
                    >
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
      </div>
    </div>
  );
}
