// apps/web/app/dashboard/recipes/[id]/page.tsx
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Buffer } from "node:buffer";

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

// base64url -> JSON
function b64urlToJson<T = any>(b64url: string): T | null {
  try {
    const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch { return null; }
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

  // On récupère la recette depuis ?data= encodé par la liste
  const r = searchParams?.data ? b64urlToJson<Recipe>(searchParams.data) : null;

  if (!r || !r.title) {
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

  // Si l'utilisateur n'a pas le plan requis pour cette recette
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

  // Rendu de la page détail (OK pour BASIC si recette BASIC)
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
          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
            {r.ingredients.map((i, k) => <li key={k}>{i}</li>)}
          </ul>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Préparation</h3>
          <ol style={{ marginTop: 6, paddingLeft: 18 }}>
            {r.steps.length
              ? r.steps.map((s, k) => <li key={k}>{s}</li>)
              : <li>Étapes à générer selon vos préférences.</li>}
          </ol>
        </article>
      </div>

      <div style={{ marginTop: 16 }}>
        <a className="btn btn-outline" href="/dashboard/recipes">← Retour</a>
      </div>
    </div>
  );
}
