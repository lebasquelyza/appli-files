// apps/web/app/dashboard/recipes/[id]/page.tsx

/* ===================== Types ===================== */
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

/* ===================== Utils ===================== */
function decodeB64UrlJson<T = any>(value?: string | null): T | null {
  if (!value) return null;
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);

    // Navigateur
    if (typeof atob === "function") {
      const bin = atob(padded);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    }

    // Node.js
    // @ts-ignore
    const B: any = (globalThis as any).Buffer;
    const json = B.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* ===================== Page ===================== */
export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { data?: string };
}) {
  const dataParam = searchParams?.data ?? null;
  const recipe = decodeB64UrlJson<Recipe>(dataParam);

  return (
    <>
      {/* spacer éventuel pour topbar fixe */}
      <div className="h-10" aria-hidden="true" />

      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        {/* ===== Bouton Retour (NOIR) ===== */}
        <div style={{ marginBottom: 16 }}>
          <a
            href="/dashboard/recipes"
            className="btn btn-outline"
            style={{ color: "#111", borderColor: "#111" }} // <- seul changement
          >
            Retour
          </a>
        </div>

        {/* ===== Contenu recette ===== */}
        {recipe ? (
          <article className="card" style={{ overflow: "hidden" }}>
            <header style={{ marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{recipe.title}</h1>
              {recipe.subtitle && (
                <p className="text-sm" style={{ marginTop: 6, color: "#6b7280" }}>
                  {recipe.subtitle}
                </p>
              )}
              <div className="text-sm" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {typeof recipe.kcal === "number" && <span className="badge">{recipe.kcal} kcal</span>}
                {typeof recipe.timeMin === "number" && <span className="badge">{recipe.timeMin} min</span>}
                <span className="badge">{recipe.minPlan}</span>
              </div>
            </header>

            <section style={{ marginTop: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Ingrédients</h2>
              <ul style={{ margin: "8px 0 0 18px" }}>
                {recipe.ingredients?.map((i, idx) => <li key={idx}>{i}</li>)}
              </ul>
            </section>

            <section style={{ marginTop: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Étapes</h2>
              <ol style={{ margin: "8px 0 0 18px" }}>
                {recipe.steps?.map((s, idx) => <li key={idx}>{s}</li>)}
              </ol>
            </section>

            {Array.isArray(recipe.rework) && recipe.rework.length > 0 && (
              <section style={{ marginTop: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Re-travailler certains aliments</h2>
                <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: 8 }}>
                  {recipe.rework.map((rw, idx) => (
                    <div key={idx} className="card">
                      <strong style={{ display: "block", marginBottom: 6 }}>{rw.ingredient}</strong>
                      <ul style={{ margin: "4px 0 0 18px" }}>
                        {rw.tips.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </article>
        ) : (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            Impossible de charger cette recette. Revenez en arrière puis rouvrez-la depuis la liste.
          </div>
        )}
      </div>
    </>
  );
}
