import { readAppleStepsDaily } from "@/lib/apple";

function todayYMDParis() {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/**
 * Card UI : Pas du jour depuis Apple Santé (après import export.zip)
 * (Server Component)
 */
export function ProgressAppleStepsCard({
  locale = "fr-FR",
  title = "Pas (Apple Santé)",
}: {
  locale?: string;
  title?: string;
}) {
  const stepsDaily = readAppleStepsDaily();
  const today = todayYMDParis();
  const stepsToday = stepsDaily[today];

  return (
    <article className="card">
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
      </div>

      {typeof stepsToday === "number" ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {stepsToday.toLocaleString(locale)} pas
          </div>
          <div className="text-sm" style={{ color: "#6b7280" }}>
            {today}
          </div>
        </div>
      ) : (
        <div className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
          Pas encore de pas importés aujourd’hui.
        </div>
      )}

      <div
        className="text-xs"
        style={{ color: "#6b7280", marginTop: 10, lineHeight: 1.35 }}
      >
        Astuce : importe ton <b>export.zip</b> Apple Santé dans la page Connexions pour remplir les données.
      </div>
    </article>
  );
}
