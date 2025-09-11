export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Recipe = {
  id: string;
  title: string;
  subtitle?: string;
  kcal?: number;
  timeMin?: number;
  tags: string[];
  goals: string[];
  minPlan: "BASIC" | "PLUS" | "PREMIUM";
  ingredients: string[];
  steps: string[];
};

/* ---- b64url -> JSON (Node + Browser safe) ---- */
function b64urlToJson<T = any>(b64url: string): T | null {
  try {
    const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
    if (typeof window === "undefined") {
      // @ts-ignore Buffer dispo côté Node
      const json = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json);
    } else {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    }
  } catch { return null; }
}

/* ---- normalisation ---- */
function normalizeRecipe(raw: any, id: string): Recipe | null {
  const title = String(raw?.title ?? "").trim();
  if (!title) return null;
  return {
    id,
    title,
    subtitle: raw?.subtitle ? String(raw.subtitle).trim() : undefined,
    kcal: typeof raw?.kcal === "number" ? raw.kcal : undefined,
    timeMin: typeof raw?.timeMin === "number" ? raw.timeMin : undefined,
    tags: Array.isArray(raw?.tags) ? raw.tags.map((t: any) => String(t).trim()) : [],
    goals: Array.isArray(raw?.goals) ? raw.goals.map((g: any) => String(g).trim()) : [],
    minPlan: (["BASIC","PLUS","PREMIUM"].includes(raw?.minPlan) ? raw.minPlan : "BASIC"),
    ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.map((x: any) => String(x)) : [],
    steps: Array.isArray(raw?.steps) ? raw.steps.map((x: any) => String(x)) : [],
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { data?: string };
}) {
  const raw = searchParams?.data ? b64urlToJson<any>(searchParams.data) : null;
  const r = raw ? normalizeRecipe(raw, params.id) : null;

  if (!r) {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="section" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Recette introuvable</h2>
          <p>Ouvrez la fiche depuis la liste des recettes.</p>
          <a href="/dashboard/recipes" className="btn btn-dash">← Retour aux recettes</a>
        </div>
      </div>
    );
  }

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
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Ingrédients</h3>
          {r.ingredients.length ? (
            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {r.ingredients.map((i, k) => <li key={k}>{i}</li>)}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: "#6b7280" }}>Pas d’ingrédients détaillés.</p>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Préparation</h3>
          {r.steps.length ? (
            <ol style={{ marginTop: 6, paddingLeft: 18 }}>
              {r.steps.map((s, k) => <li key={k}>{s}</li>)}
            </ol>
          ) : (
            <p className="text-sm" style={{ color: "#6b7280" }}>Pas d’étapes détaillées.</p>
          )}
        </article>
      </div>

      <div style={{ marginTop: 16 }}>
        <a className="btn btn-outline" href="/dashboard/recipes">← Retour</a>
      </div>
    </div>
  );
}
