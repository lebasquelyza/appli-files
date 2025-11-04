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
  renderCard,
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
  renderCard: (r: Recipe) => React.ReactNode;
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
          }),
        });

        const data = await res.json().catch(() => ({} as any));

        if (cancelled) return;

        if (Array.isArray(data.recipes) && data.recipes.length) {
          // Normalisation simple
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
      } catch (e: any) {
        if (!cancelled) {
          setError("Erreur de connexion à l’IA");
        }
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
  ]);

  return (
    <section className="section" style={{ marginTop: 12 }}>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2>Recettes personnalisées (IA)</h2>
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
          {recipes.map((r) => renderCard(r))}
        </div>
      ) : (
        <div className="card text-sm" style={{ color: "#6b7280" }}>
          Aucune recette personnalisée pour le moment.
        </div>
      )}
    </section>
  );
}
