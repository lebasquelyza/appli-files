// apps/web/app/dashboard/recipes/[id]/page.tsx
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

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

// base64url decode (compat Node 16/18)
function b64urlDecode(str: string) {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function sanitizeRecipe(r: any, forcedId: string): Recipe | null {
  const rec: Recipe = {
    id: forcedId,
    title: String(r?.title || "").trim(),
    subtitle: r?.subtitle ? String(r.subtitle).trim() : undefined,
    kcal: typeof r?.kcal === "number" ? r.kcal : undefined,
    timeMin: typeof r?.timeMin === "number" ? r.timeMin : undefined,
    tags: Array.isArray(r?.tags) ? r.tags.map((t: any) => String(t).trim()) : [],
    goals: Array.isArray(r?.goals) ? r.goals.map((g: any) => String(g).trim()) : [],
    minPlan: (["BASIC","PLUS","PREMIUM"].includes(r?.minPlan) ? r.minPlan : "BASIC") as Plan,
    ingredients: Array.isArray(r?.ingredients) ? r.ingredients.map((i: any) => String(i)) : [],
    steps: Array.isArray(r?.steps) ? r.steps.map((s: any) => String(s)) : [],
  };
  if (!rec.title || rec.ingredients.length < 3 || rec.steps.length < 2) return null;
  return rec;
}

export default async function Page({
  params, searchParams,
}: {
  params: { id: string };
  searchParams?: { data?: string };
}) {
  const s = await getSession();
  const plan: Plan = (s?.plan as Plan) || "BASIC";
  const isBasic = plan === "BASIC";

  // 1) On lit la recette encodée dans l’URL
  let recipe: Recipe | null = null;
  const dataParam = (searchParams?.data ?? "") as string;
  if (dataParam) {
    try {
      const json = b64urlDecode(dataParam);
      const obj = JSON.parse(json);
      recipe = sanitizeRecipe(obj, params.id);
    } catch { /* noop */ }
  }

  if (!recipe) {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <h1 className="h1">Recette introuvable</h1>
        <p className="lead">Impossible de charger cette recette depuis la liste.</p>
        <a href="/dashboard/recipes" className="btn btn-dash" style={{ marginTop: 12 }}>Retour aux recettes</a>
      </div>
    );
  }

  // 2) Contrôle d’accès fin : si la recette dépasse le plan courant, upsell + blocage
  if (planRank(plan) < planRank(recipe.minPlan)) {
    const need = recipe.minPlan === "PREMIUM" ? "PREMIUM" : "PLUS";
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <h1 className="h1" style={{ marginBottom: 6 }}>{recipe.title}</h1>
        <p className="lead" style={{ marginBottom: 16 }}>
          Cette recette est réservée au plan {recipe.minPlan}.
        </p>
        <a className="btn btn-dash" href="/dashboard/abonnement">Passer à {need}</a>
      </div>
    );
  }

  // ✅ En BASIC, on autorise la lecture d’une recette BASIC (lecture seule)
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <h1 className="h1" style={{ marginBottom: 6 }}>{recipe.title}</h1>
      {recipe.subtitle && <p className="lead">{recipe.subtitle}</p>}

      {isBasic && (
        <div className="card" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <strong>Fonctionnalités avancées</strong>
            <div className="text-sm" style={{ color: "#6b7280" }}>
              Passez à PLUS/PREMIUM pour ajouter au plan, voir des variantes, et générer des menus.
            </div>
          </div>
          <a className="btn btn-dash" href="/dashboard/abonnement">Voir les offres</a>
        </div>
      )}

      <div className="section" style={{ marginTop: 12 }}>
        <div className="text-sm" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="badge">{recipe.minPlan}</span>
          {typeof recipe.kcal === "number" && <span className="badge">{recipe.kcal} kcal</span>}
          {typeof recipe.timeMin === "number" && <span className="badge">{recipe.timeMin} min</span>}
          {recipe.tags.map((t) => <span key={t} className="badge">{t}</span>)}
        </div>

        <div className="grid gap-6 lg:grid-cols-2" style={{ marginTop: 12 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Ingrédients</h2>
            <ul style={{ margin: "6px 0 0 16px" }}>
              {recipe.ingredients.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Étapes</h2>
            <ol style={{ margin: "6px 0 0 16px" }}>
              {recipe.steps.map((s, idx) => <li key={idx}>{s}</li>)}
            </ol>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <a href="/dashboard/recipes" className="btn btn-outline">← Retour</a>
          <button
            className="btn btn-dash"
            type="button"
            disabled={isBasic}
            title={isBasic ? "Passez à PLUS pour ajouter au plan" : undefined}
          >
            Ajouter à mon plan
          </button>
        </div>
      </div>
    </div>
  );
}
