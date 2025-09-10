// apps/web/app/dashboard/recipes/[id]/page.tsx
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Plan = "BASIC" | "PLUS" | "PREMIUM";
type Recipe = {
  id: string;
  title: string;
  subtitle?: string;
  kcal?: number;
  timeMin?: number;
  tags: string[];
  goals: string[];
  minPlan: Plan;
  ingredients: string[];
  steps: string[];
};

function planRank(p?: Plan) { return p === "PREMIUM" ? 3 : p === "PLUS" ? 2 : 1; }

/* ---- b64url -> JSON (Node + Browser) ---- */
function b64urlToJson<T = any>(b64url: string): T | null {
  try {
    const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
    let json = "";
    if (typeof window === "undefined") {
      // @ts-ignore Buffer dispo côté Node
      json = Buffer.from(b64, "base64").toString("utf8");
    } else {
      json = decodeURIComponent(escape(atob(b64)));
    }
    return JSON.parse(json);
  } catch { return null; }
}

/* ---- Normalise pour éviter toutes erreurs au rendu ---- */
function normalizeRecipe(raw: any, forcedId: string): Recipe | null {
  const title = String(raw?.title ?? "").trim();
  if (!title) return null;

  const minPlan = (["BASIC","PLUS","PREMIUM"].includes(raw?.minPlan) ? raw.minPlan : "BASIC") as Plan;

  const ingredients = Array.isArray(raw?.ingredients)
    ? raw.ingredients.map((x: any) => String(x))
    : [];

  const steps = Array.isArray(raw?.steps)
    ? raw.steps.map((x: any) => String(x))
    : [];

  return {
    id: forcedId,
    title,
    subtitle: raw?.subtitle ? String(raw.subtitle).trim() : undefined,
    kcal: typeof raw?.kcal === "number" ? raw.kcal : undefined,
    timeMin: typeof raw?.timeMin === "number" ? raw.timeMin : undefined,
    tags: Array.isArray(raw?.tags) ? raw.tags.map((t: any) => String(t).trim()) : [],
    goals: Array.isArray(raw?.goals) ? raw.goals.map((g: any) => String(g).trim()) : [],
    minPlan,
    ingredients,
    steps,
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { data?: string };
}) {
  const s: any = await getSession().catch(() => ({}));
  const plan: Plan = (s?.plan as Plan) || "BASIC";

  const rRaw = searchParams?.data ? b64urlToJson<any>(searchParams.data) : null;
  const r = rRaw ? normalizeRecipe(rRaw, params.id) : null;

  if (!r) {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="section" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Recette introuvable</h2>
          <p>Impossible d’afficher cette recette. Ouvrez-la depuis la liste.</p>
          <a href="/dashboard/recipes" className="btn btn-dash">← Retour aux recettes</a>
        </div>
      </div>
    );
  }

  if (planRank(plan) < planRank(r.minPlan)) {
    const need = r.minPlan === "PREMIUM" ? "PREMIUM" : "PLUS";
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="section" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>{r.title}</h2>
          <p className="lead" style={{ marginBottom: 16 }}>
            Cette recette est réservée au plan <strong>{r.minPlan}</strong>.
          </p>
          <a className="btn btn-dash" href="/dashboard/abonnement">Passer à {need}</a>
        </div>
      </div>
    );
  }

  const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps : [];

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header">
        <div>
          <h1 className="h1">{r.title}</h1>
          {r.subtitle && <p className="lead">{r.subtitle}</p>}
        </div>
        <div className="text-sm" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
          {typeof r.timeMin === "number" && <span className="badge">{r.timeMin} min</span>}
          <span className="badge">{r.minPlan}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Ingrédients</h3>
          {ing.length ? (
            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {ing.map((i, k) => <li key={k}>{i}</li>)}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: "#6b7280" }}>Pas d’ingrédients détaillés pour cette suggestion.</p>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Préparation</h3>
          {steps.length ? (
            <ol style={{ marginTop: 6, paddingLeft: 18 }}>
              {steps.map((s, k) => <li key={k}>{s}</li>)}
            </ol>
          ) : (
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Étapes non fournies. Passez à PLUS/PREMIUM pour des instructions générées.
            </p>
          )}
        </article>
      </div>

      <div style={{ marginTop: 16 }}>
        <a className="btn btn-outline" href="/dashboard/recipes">← Retour</a>
      </div>
    </div>
  );
}
