// apps/web/app/dashboard/recipes/AISection.tsx
"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

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

type SavedItem = { id: string; title: string };

function encodeB64UrlJsonBrowser(data: any): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lecture du cookie "saved_recipes_v1" côté client */
function readSavedClient(): SavedItem[] {
  if (typeof document === "undefined") return [];
  try {
    const all = document.cookie.split("; ").filter(Boolean);
    const entry = all.find((c) => c.startsWith("saved_recipes_v1="));
    if (!entry) return [];
    const raw = decodeURIComponent(entry.split("=", 2)[1] || "[]");
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter(
          (x) =>
            x && typeof x.id === "string" && typeof x.title === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** Écriture du cookie "saved_recipes_v1" côté client */
function writeSavedClient(list: SavedItem[]) {
  if (typeof document === "undefined") return;
  try {
    const raw = JSON.stringify(list);
    const encoded = encodeURIComponent(raw);
    const maxAge = 60 * 60 * 24 * 365; // 1 an
    document.cookie = `saved_recipes_v1=${encoded}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch {
    // silent
  }
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
  const { t } = useLanguage();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ids des recettes enregistrées (pour l'état du bouton)
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const allergensKey = allergens.join(",");
  const dislikesKey = dislikes.join(",");

  // Initialisation des recettes enregistrées depuis le cookie
  useEffect(() => {
    const saved = readSavedClient();
    setSavedIds(saved.map((s) => s.id));
  }, []);

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
            count: 3, // ⬅️ léger pour éviter les timeout
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(
            "[AIExtraSection] Erreur HTTP /api/recipes/ai:",
            res.status,
            res.statusText,
            text,
          );
          if (!cancelled) {
            setError(
              `${t("recipes.aiSection.unavailable")} (HTTP ${res.status})`,
            );
            setLoading(false);
          }
          return;
        }

        const data = await res.json();

        if (!cancelled && data && data.error) {
          console.error(
            "[AIExtraSection] API logical error:",
            data.error,
            data.detail,
          );
          setError(
            `${t("recipes.aiSection.unavailable")} (${data.error})`,
          );
          setLoading(false);
          return;
        }

        const arr: Recipe[] = Array.isArray(data?.recipes)
          ? data.recipes
          : [];
        if (!cancelled) {
          setRecipes(arr);
          setLoading(false);
        }
      } catch (e) {
        console.error("[AIExtraSection] fetch error /api/recipes/ai:", e);
        if (!cancelled) {
          setError(
            `${t("recipes.aiSection.unavailable")} (FETCH_ERROR)`,
          );
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [kind, kcal, kcalMin, kcalMax, allergensKey, dislikesKey, t]);

  const title = t("recipes.aiSection.title") || "Suggestion";
  const subtitle =
    t("recipes.aiSection.subtitle") ||
    "Généré en direct avec l'IA selon tes filtres";

  /** Enregistrer une recette IA dans le cookie (comme les autres) */
  function handleSave(r: Recipe) {
    const current = readSavedClient();
    if (!current.some((x) => x.id === r.id)) {
      const next = [...current, { id: r.id, title: r.title }];
      writeSavedClient(next);
      setSavedIds(next.map((s) => s.id));
    }
  }

  /** Retirer une recette IA des favoris */
  function handleUnsave(r: Recipe) {
    const current = readSavedClient();
    const next = current.filter((x) => x.id !== r.id);
    writeSavedClient(next);
    setSavedIds(next.map((s) => s.id));
  }

  return (
    <section className="section" style={{ marginTop: 12 }}>
      <div
        className="section-head"
        style={{
          marginBottom: 8,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {/* Titre = "Suggestion" */}
        <h2 style={{ margin: 0 }}>{title}</h2>
        {/* Sous-titre plus petit, aligné à droite */}
        <p
          className="text-xs"
          style={{
            color: "#6b7280",
            margin: 0,
            fontSize: "10px",
            textAlign: "right",
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* État erreur */}
      {error && (
        <div className="card text-xs" style={{ color: "#6b7280" }}>
          {error}
        </div>
      )}

      {/* État chargement */}
      {!error && loading && recipes.length === 0 && (
        <div className="card text-xs" style={{ color: "#6b7280" }}>
          {t("recipes.aiSection.loading")}
        </div>
      )}

      {/* État avec recettes */}
      {!error && recipes.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {recipes.map((r) => {
            const href = `/dashboard/recipes/${r.id}?${baseQS}data=${encodeB64UrlJsonBrowser(
              r,
            )}`;
            const isSaved = savedIds.includes(r.id);

            return (
              <article
                key={r.id}
                className="card"
                style={{ overflow: "hidden" }}
              >
                <div className="flex items-center justify-between">
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    {r.title}
                  </h3>
                  {/* Badge IA supprimé */}
                </div>

                {r.subtitle && (
                  <p
                    className="text-sm"
                    style={{ marginTop: 4, color: "#6b7280" }}
                  >
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
                  {typeof r.kcal === "number" && (
                    <span className="badge">{r.kcal} kcal</span>
                  )}
                  {typeof r.timeMin === "number" && (
                    <span className="badge">{r.timeMin} min</span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <a className="btn btn-dash" href={href}>
                    {t("recipes.card.viewRecipe")}
                  </a>

                  {/* Bouton Enregistrer / Retirer (client-side, via cookie) */}
                  {isSaved ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ color: "var(--text, #111)" }}
                      onClick={() => handleUnsave(r)}
                    >
                      {t("recipes.card.savedRemove")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ color: "var(--text, #111)" }}
                      onClick={() => handleSave(r)}
                    >
                      {t("recipes.card.save")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
