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

/* ---- b64url -> JSON (Node + Edge + Browser safe) ---- */
function b64urlToJson<T = any>(b64url: string): T | null {
  try {
    const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
    const B: any = (globalThis as any).Buffer;

    // Node
    if (typeof window === "undefined" && B?.from) {
      const json = B.from(b64, "base64").toString("utf8");
      return JSON.parse(json);
    }

    // Edge/Browser
    const atobFn: ((s: string) => string) | undefined = (globalThis as any).atob;
    let bin: string;
    if (typeof atobFn === "function") {
      bin = atobFn(b64);
    } else if (B?.from) {
      bin = B.from(b64, "base64").toString("binary");
    } else {
      bin = "";
    }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch { return null; }
}

/* ---- Normalise ---- */
function normalizeRecipe(raw: any, forcedId: string) {
  const title = String(raw?.title ?? "").trim();
  if (!title) return null;
  const arrRework: Rework[] = Array.isArray(raw?.rework)
    ? raw.rework.map((x: any) => ({
        ingredient: String(x?.ingredient || "").toLowerCase(),
        tips: Array.isArray(x?.tips) ? x.tips.map((t: any) => String(t)) : []
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
    minPlan: (["BASIC","PLUS","PREMIUM"].includes(raw?.minPlan) ? raw.minPlan : "BASIC") as Plan,
    ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.map((x: any) => String(x)) : [],
    steps: Array.isArray(raw?.steps) ? raw.steps.map((x: any) => String(x)) : [],
    rework: arrRework,
  } as Recipe;
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

  const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps : [];
  const hasRework = Array.isArray(r.rework) && r.rework.length > 0;

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

      {/* Re-travailler */}
      {hasRework && (
        <article className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Re-travailler les aliments non aimés</h3>
          <p className="text-sm" style={{ color:"#6b7280", marginTop: -4 }}>
            On garde le produit et on propose d’autres façons de le cuisiner :
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {r.rework!.map((rw, idx) => (
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
