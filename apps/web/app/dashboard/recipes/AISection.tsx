"use client";

import { useEffect, useState } from "react";

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

export function AISection({
  initialRecipes,
  filters,
  relaxedNote,
  variant = "meals",
  title,
}: {
  initialRecipes: Recipe[];
  filters: {
    plan: Plan;
    kcal?: number;
    kcalMin?: number;
    kcalMax?: number;
    allergens: string[];
    dislikes: string[];
  };
  relaxedNote: string | null;
  variant?: "meals" | "shakes";
  title?: string;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/recipes-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: filters.plan,
            kcal: filters.kcal,
            kcalMin: filters.kcalMin,
            kcalMax: filters.kcalMax,
            allergens: filters.allergens,
            dislikes: filters.dislikes,
            count: 16,
            kind: variant, // 👈 meals ou shakes
          }),
        });

        const data = await res.json().catch(() => ({} as any));

        if (cancelled) return;

        if (Array.isArray(data.recipes) && data.recipes.length) {
          const mapped: Recipe[] = data.recipes.map((raw: any) => {
            const title = String(raw?.title ?? "").trim() || "Recette";
            const id = String(raw?.id || title || Math.random().toString(36).slice(2))
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9-]+/g, "-");

            const rework: Rework[] | undefined = Array.isArray(raw?.rework)
              ? raw.rework.map((x: any) => ({
                  ingredient: String(x?.ingredient || "").toLowerCase(),
                  tips: Array.isArray(x?.tips) ? x.tips.map((t: any) => String(t)) : [],
                }))
              : undefined;

            return {
              id,
              title,
              subtitle: raw?.subtitle ? String(raw.subtitle) : undefined,
              kcal: typeof raw?.kcal === "number" ? raw.kcal : undefined,
              timeMin: typeof raw?.timeMin === "number" ? raw.timeMin : undefined,
              tags: Array.isArray(raw?.tags) ? raw.tags.map((t: any) => String(t)) : [],
              goals: Array.isArray(raw?.goals) ? raw.goals.map((g: any) => String(g)) : [],
              minPlan: (["BASIC", "PLUS", "PREMIUM"].includes(raw?.minPlan)
                ? raw.minPlan
                : filters.plan) as Plan,
              ingredients: Array.isArray(raw?.ingredients)
                ? raw.ingredients.map((x: any) => String(x))
                : [],
              steps: Array.isArray(raw?.steps) ? raw.steps.map((x: any) => String(x)) : [],
              rework,
            };
          });

          setRecipes(mapped);
        }

        if (data.error && !cancelled) {
          setError(data.error);
        }
      } catch {
        if (!cancelled) setError("Erreur de connexion à l’IA");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    filters.plan,
    filters.kcal,
    filters.kcalMin,
    filters.kcalMax,
    filters.allergens.join(","),
    filters.dislikes.join(","),
    variant,
  ]);

  return (
    <section className="section" style={{ marginTop: 12 }}>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2>{title ?? "Recettes personnalisées (IA)"}</h2>
      </div>

      {relaxedNote && (
        <div className="text-xs" style={{ color: "#6b7280", marginBottom: 4 }}>
          {relaxedNote}
        </div>
      )}

      {loading && (
        <div className="text-sm" style={{ color: "#6b7280", marginBottom: 8 }}>
          Génération des recettes avec l’IA…
        </div>
      )}

      {error && (
        <div className="card text-sm" style={{ color: "#b91c1c", marginBottom: 8 }}>
          {error} — affichage des suggestions de base.
        </div>
      )}

      {recipes.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {recipes.map((r) => {
            const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
            const shown = ing.slice(0, 8);
            const more = Math.max(0, ing.length - shown.length);

            return (
              <article key={r.id} className="card" style={{ overflow: "hidden" }}>
                <div className="flex items-center justify-between">
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
                </div>

                <div
                  className="text-sm"
                  style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}
                >
                  {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
                  {typeof r.timeMin === "number" && (
                    <span className="badge">{r.timeMin} min</span>
                  )}
                </div>

                <div className="text-sm" style={{ marginTop: 10 }}>
                  <strong>Ingrédients</strong>
                  <ul style={{ margin: "6px 0 0 16px" }}>
                    {shown.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                    {more > 0 && <li>+ {more} autre(s)…</li>}
                  </ul>
                </div>

                {Array.isArray(r.steps) && r.steps.length > 0 && (
                  <div className="text-sm" style={{ marginTop: 10 }}>
                    <strong>Préparation</strong>
                    <ul style={{ margin: "6px 0 0 16px" }}>
                      {r.steps.slice(0, 3).map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                      {r.steps.length > 3 && <li>…</li>}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card text-sm" style={{ color: "#6b7280" }}>
          Aucune recette personnalisée pour le moment.
        </div>
      )}
    </section>
  );
}

