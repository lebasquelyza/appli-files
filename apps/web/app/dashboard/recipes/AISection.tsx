//apps/web/app/dashboard/recipes/AISection.tsx
"use client";

import { useEffect, useState } from "react";

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
  rework?: { ingredient: string; tips: string[] }[];
};

type Props = {
  kind: "meals" | "shakes";
  baseQS: string;
  kcal?: number;
  kcalMin?: number;
  kcalMax?: number;
  allergens: string[];
  dislikes: string[];
};

function encodeB64UrlJsonBrowser(data: any): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function AIExtraSection({
  kind,
  baseQS,
  kcal,
  kcalMin,
  kcalMax,
  allergens,
  dislikes,
}: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allergensKey = allergens.join(",");
  const dislikesKey = dislikes.join(",");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setRecipes([]);

      try {
        const res = await fetch("/api/recipes/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            kcal,
            kcalMin,
            kcalMax,
            allergens,
            dislikes,
            count: 8,
          }),
        });

        console.log("[AIExtraSection] /api/recipes/ai status:", res.status);

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(
            "[AIExtraSection] Erreur HTTP /api/recipes/ai:",
            res.status,
            res.statusText,
            text
          );
          if (!cancelled) {
            setError(`IA indisponible pour le moment. (HTTP ${res.status})`);
            setLoading(false);
          }
          return;
        }

        const data = await res.json();
        console.log("[AIExtraSection] data:", data);

        if (!cancelled && data && data.error) {
          console.error("[AIExtraSection] API logical error:", data.error, data.detail);
          setError(`IA indisponible pour le moment. (${data.error})`);
          setLoading(false);
          return;
        }

        const arr: Recipe[] = Array.isArray(data?.recipes) ? data.recipes : [];
        if (!cancelled) {
          setRecipes(arr);
          setLoading(false);
        }
      } catch (e) {
        console.error("[AIExtraSection] fetch error /api/recipes/ai:", e);
        if (!cancelled) {
          setError("IA indisponible pour le moment. (FETCH_ERROR)");
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [kind, kcal, kcalMin, kcalMax, allergensKey, dislikesKey]);

  return (
    <section className="section" style={{ marginTop: 12 }}>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2>Suggestions perso IA</h2>
        <p className="text-xs" style={{ color: "#6b7280", marginTop: 4 }}>
          Générées en direct avec l&apos;IA selon tes filtres.
        </p>
      </div>

      {/* État erreur */}
      {error && (
        <div className="card text-xs" style={{ color: "#6b7280" }}>
          {error}
        </div>
      )}

      {/* État chargement (si pas d'erreur) */}
      {!error && loading && recipes.length === 0 && (
        <div className="card text-xs" style={{ color: "#6b7280" }}>
          Génération en cours…
        </div>
      )}

      {/* État avec recettes */}
      {!error && recipes.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {recipes.map((r) => {
            const href = `/dashboard/recipes/${r.id}?${baseQS}data=${encodeB64UrlJsonBrowser(r)}`;

            return (
              <article key={r.id} className="card" style={{ overflow: "hidden" }}>
                <div className="flex items-center justify-between">
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
                  <span className="badge">perso IA</span>
                </div>

                {r.subtitle && (
                  <p className="text-sm" style={{ marginTop: 4, color: "#6b7280" }}>
                    {r.subtitle}
                  </p>
                )}

                <div
                  className="text-sm"
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
                  {typeof r.timeMin === "number" && (
                    <span className="badge">{r.timeMin} min</span>
                  )}
                </div>

                {/* 🔹 plus d'ingrédients visibles sur la carte IA */}

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <a className="btn btn-dash" href={href}>
                    Voir la recette
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
