// apps/web/app/dashboard/page.tsx
import { cookies } from "next/headers";
import { PageHeader, Section } from "@/components/ui/Page";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Plan = "BASIC" | "PLUS" | "PREMIUM";
type EntryType = "steps" | "load" | "weight";

type ProgressEntry = {
  id: string;
  type: EntryType;
  date: string;      // YYYY-MM-DD
  value: number;     // pas / kg
  reps?: number;
  note?: string;
  createdAt: string; // ISO
};
type Store = { entries: ProgressEntry[] };

/* ---------- Utils ---------- */
function parseProgress(val?: string | null): Store {
  if (!val) return { entries: [] };
  try {
    const obj = JSON.parse(val);
    if (Array.isArray(obj?.entries)) return { entries: obj.entries as ProgressEntry[] };
  } catch {}
  return { entries: [] };
}
function parseJson(val?: string | null): any {
  try { return val ? JSON.parse(val) : null; } catch { return null; }
}
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}
function fmtDate(dateISO: string) {
  try {
    const d = new Date(dateISO);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("fr-FR", { year:"numeric", month:"long", day:"numeric" });
  } catch {}
  return dateISO;
}
// semaine (lundi → dimanche)
function startOfWeekMonday(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // Lundi=0
  x.setDate(x.getDate() - diff);
  return x;
}
function endOfWeekFromMonday(monday: Date) {
  const s = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  s.setDate(s.getDate()+6);
  return s;
}
function parseYMDLocal(s: string) {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, d||1);
}

/* ---------- Page ---------- */
export default async function Page() {
  const jar = cookies();

  // Session (plan actif)
  let sess: any = {};
  try { sess = await getSession(); } catch {}
  const plan: Plan = (sess?.plan as Plan) || "BASIC";

  // Progress (pas/charges/poids)
  const progress = parseProgress(jar.get("app_progress")?.value);
  const lastWeight = progress.entries.find(e => e.type === "weight");
  const lastLoad   = progress.entries.find(e => e.type === "load");

  // Pas semaine en cours
  const now = new Date();
  const monday = startOfWeekMonday(now);
  const sunday = endOfWeekFromMonday(monday);
  const stepsThisWeek = progress.entries
    .filter(e => e.type === "steps")
    .filter(e => {
      const d = parseYMDLocal(e.date);
      return d >= monday && d <= sunday;
    })
    .reduce((sum, e) => sum + (Number(e.value) || 0), 0);

  // Calories du jour (essaye plusieurs structures possibles)
  const kcalsCookie = parseJson(jar.get("app.kcals")?.value) || {};
  const ymd = todayYMD();
  const kcalsToday =
    (typeof kcalsCookie?.kcals?.[ymd] === "number" && kcalsCookie.kcals[ymd]) ??
    (typeof kcalsCookie?.[ymd] === "number" && kcalsCookie[ymd]) ??
    0;

  // Idées recettes (teasers, cliquables)
  const ideas = [
    { id:"omelette-epinards", label:"Omelette épinards" },
    { id:"yaourt-fruits",     label:"Yaourt grec + fruits" },
    { id:"poulet-riz-brocoli",label:"Poulet + riz + brocoli" },
    { id:"bowl-quinoa",       label:"Bowl quinoa" },
  ];

  // Exos rapides (statique)
  const quick = ["20 squats lents", "3×30″ planche", "2′ mobilité hanches", "Marche 10′"];

  return (
    <>
      {/* Bandeau d’accueil compact */}
      <section className="section" style={{ marginTop: 0 }}>
        <div className="card" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>Bienvenue 👋</h2>
            <div className="text-sm" style={{ marginTop:6, color:"#6b7280" }}>
              Exos simples, recettes et suivi — tout pour bouger aujourd’hui.
            </div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <a className="btn btn-outline" href="/dashboard/recipes">Recettes</a>
            <a className="btn btn-outline" href="/dashboard/progress">Mes progrès</a>
            <a className="btn btn-dash" href="/dashboard/muscu">Commencer une séance</a>
          </div>
        </div>
      </section>

      {/* Stats en un coup d’œil */}
      <Section title="En un coup d’œil">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <article className="card">
            <div className="flex items-center justify-between">
              <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>Plan</h3>
              <span className="badge">{plan}</span>
            </div>
            <p className="text-sm" style={{ color:"#6b7280", marginTop:6 }}>
              Gérer mon offre, options et IA.
            </p>
            <div style={{ marginTop:10 }}>
              <a className="btn btn-outline" href="/dashboard/pricing">Voir les offres</a>
            </div>
          </article>

          <article className="card">
            <div className="flex items-center justify-between">
              <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>Calories aujourd’hui</h3>
              <span className="badge">Journal</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, marginTop:6 }}>{kcalsToday.toLocaleString("fr-FR")} kcal</div>
            <div style={{ marginTop:10 }}>
              <a className="btn btn-outline" href="/dashboard/calories">Enregistrer</a>
            </div>
          </article>

          <article className="card">
            <div className="flex items-center justify-between">
              <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>Pas — semaine</h3>
              <span className="badge">Lun→Dim</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, marginTop:6 }}>{stepsThisWeek.toLocaleString("fr-FR")} pas</div>
            <div style={{ marginTop:10 }}>
              <a className="btn btn-outline" href="/dashboard/progress">Ajouter des pas</a>
            </div>
          </article>

          <article className="card">
            <div className="flex items-center justify-between">
              <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>Derniers mesures</h3>
              <span className="badge">Suivi</span>
            </div>
            <ul style={{ margin:"6px 0 0 16px" }}>
              <li>Poids: <b>{lastWeight ? `${lastWeight.value} kg` : "—"}</b> {lastWeight && <span className="text-sm" style={{ color:"#6b7280" }}>({fmtDate(lastWeight.date)})</span>}</li>
              <li>Charge: <b>{lastLoad ? `${lastLoad.value} kg${lastLoad.reps ? ` × ${lastLoad.reps}` : ""}` : "—"}</b> {lastLoad && <span className="text-sm" style={{ color:"#6b7280" }}>({fmtDate(lastLoad.date)})</span>}</li>
            </ul>
            <div style={{ marginTop:10 }}>
              <a className="btn btn-outline" href="/dashboard/progress">Mettre à jour</a>
            </div>
          </article>
        </div>
      </Section>

      {/* Exercices simples */}
      <Section title="Exercices simples">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" style={{ listStyle:"none", padding:0, margin:0 }}>
          {quick.map((t) => (
            <li key={t} className="card" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
              <span>{t}</span>
              <a className="btn btn-outline" href="/dashboard/muscu">Lancer</a>
            </li>
          ))}
        </ul>
      </Section>

      {/* Idées recettes */}
      <Section title="Idées recettes">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {ideas.map(r => (
            <article key={r.id} className="card" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
              <span>{r.label}</span>
              <a className="btn btn-outline" href="/dashboard/recipes">Voir</a>
            </article>
          ))}
        </div>
      </Section>

      {/* Raccourcis utiles */}
      <Section title="Raccourcis">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <a className="card" href="/dashboard/recipes" style={{ textDecoration:"none", color:"#111" }}>
            <div className="flex items-center justify-between">
              <b>Recettes</b><span className="badge">IA</span>
            </div>
            <p className="text-sm" style={{ color:"#6b7280", marginTop:6 }}>Filtrer par calories & allergènes.</p>
          </a>
          <a className="card" href="/dashboard/progress" style={{ textDecoration:"none", color:"#111" }}>
            <div className="flex items-center justify-between">
              <b>Mes progrès</b><span className="badge">Suivi</span>
            </div>
            <p className="text-sm" style={{ color:"#6b7280", marginTop:6 }}>Pas, charges, poids.</p>
          </a>
          <a className="card" href="/dashboard/calories" style={{ textDecoration:"none", color:"#111" }}>
            <div className="flex items-center justify-between">
              <b>Calories</b><span className="badge">Journal</span>
            </div>
            <p className="text-sm" style={{ color:"#6b7280", marginTop:6 }}>Saisir le total du jour.</p>
          </a>
          <a className="card" href="/dashboard/pricing" style={{ textDecoration:"none", color:"#111" }}>
            <div className="flex items-center justify-between">
              <b>Abonnement</b><span className="badge">{plan}</span>
            </div>
            <p className="text-sm" style={{ color:"#6b7280", marginTop:6 }}>Passer à PLUS/PREMIUM.</p>
          </a>
        </div>
      </Section>
    </>
  );
}
