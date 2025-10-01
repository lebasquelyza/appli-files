// apps/web/app/dashboard/recipes/[id]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Plan = "BASIC" | "PLUS" | "PREMIUM";
type Rework = { ingredient: string; tips: string[] };
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
  rework?: Rework[];
};

/* ---------- b64url -> JSON (Node only, sans window/atob) ---------- */
function b64urlToJson<T = any>(b64url?: string | null): T | null {
  if (!b64url || typeof b64url !== "string") return null;
  try {
    const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
    // @ts-ignore Buffer dispo côté Node
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/* ---------- Normalisation ---------- */
function normalizeRecipe(raw: any, forcedId: string): Recipe | null {
  try {
    const title = String(raw?.title ?? "").trim();
    if (!title) return null;
    const rework: Rework[] = Array.isArray(raw?.rework)
      ? raw.rework.map((x: any) => ({
          ingredient: String(x?.ingredient || "").toLowerCase(),
          tips: Array.isArray(x?.tips) ? x.tips.map((t: any) => String(t)) : [],
        }))
      : [];

    return {
      id: forcedId,
      title,
      subtitle: raw?.subtitle ? String(raw.subtitle).trim() : undefined,
      kcal: typeof raw?.kcal === "number" ? raw.kcal : undefined,
      timeMin: typeof raw?.timeMin === "number" ? raw.timeMin : undefined,
      tags: Array.isArray(raw?.tags) ? raw.tags.map((t: any) => String(t).trim()) : [],
      goals: Array.isArray(raw?.goals) ? raw.goals.map((g: any) => String(g).trim()) : [],
      minPlan: (["BASIC", "PLUS", "PREMIUM"].includes(raw?.minPlan) ? raw.minPlan : "BASIC") as Plan,
      ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.map((x: any) => String(x)) : [],
      steps: Array.isArray(raw?.steps) ? raw.steps.map((x: any) => String(x)) : [],
      rework,
    };
  } catch {
    return null;
  }
}

/* ---------- Page ---------- */
export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { data?: string };
}) {
  let recipe: Recipe | null = null;
  try {
    const raw = b64urlToJson<any>(searchParams?.data);
    recipe = raw ? normalizeRecipe(raw, params.id) : null;
  } catch {
    recipe = null;
  }

  if (!recipe) {
    return (
      <div
        className="container"
        style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}
      >
        <div className="page-header">
          <div>
            <h1 className="h1" style={{ fontSize: 22 }}>Recette introuvable</h1>
            <p className="lead">Ouvre la fiche depuis la liste des recettes pour passer les données correctement.</p>
          </div>
        </div>

        <div className="card text-sm" style={{ color: "#6b7280" }}>
          Impossible de lire les informations de la recette (paramètre <code>data</code> manquant ou invalide).
        </div>

        <div style={{ marginTop: 16 }}>
          <a className="btn btn-dash" href="/dashboard/recipes">← Retour aux recettes</a>
        </div>
      </div>
    );
  }

  const ing = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const hasRework = Array.isArray(recipe.rework) && recipe.rework.length > 0;

  return (
    <div
      className="container"
      style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}
    >
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>{recipe.title}</h1>
          {recipe.subtitle && <p className="lead">{recipe.subtitle}</p>}
        </div>
        <div className="text-sm" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {typeof recipe.kcal === "number" && <span className="badge">{recipe.kcal} kcal</span>}
          {typeof recipe.timeMin === "number" && <span className="badge">{recipe.timeMin} min</span>}
          <span className="badge">{recipe.minPlan}</span>
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
            <p className="text-sm" style={{ color: "#6b7280" }}>Pas d’ingrédients détaillés.</p>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Préparation</h3>
          {steps.length ? (
            <ol style={{ marginTop: 6, paddingLeft: 18 }}>
              {steps.map((s, k) => <li key={k}>{s}</li>)}
            </ol>
          ) : (
            <p className="text-sm" style={{ color: "#6b7280" }}>Pas d’étapes détaillées.</p>
          )}
        </article>
      </div>

      {hasRework && (
        <article className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Re-travailler les aliments non aimés</h3>
          <p className="text-sm" style={{ color:"#6b7280", marginTop: -4 }}>
            On garde le produit et on propose d’autres façons de le cuisiner :
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {recipe.rework!.map((rw, idx) => (
              <div key={idx} className="text-sm">
                <strong style={{ textTransform:"capitalize" }}>{rw.ingredient}</strong>
                <ul style={{ margin: "6px 0 0 18px" }}>
                  {rw.tips.map((t, k) => <li key={k}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </article>
      )}

      <div style={{ marginTop: 16 }}>
        <a className="btn btn-outline" href="/dashboard/recipes">← Retour</a>
      </div>
    </div>
  );
}
