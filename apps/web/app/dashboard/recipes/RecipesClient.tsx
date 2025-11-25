// apps/web/app/dashboard/recipes/RecipesClient.tsx
"use client";

import { AIExtraSection } from "./AISection";
import { useLanguage } from "@/components/LanguageProvider";

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

type RecipeCardData = Recipe & { detailQS: string };

type SavedItem = { id: string; title: string };

type Props = {
  lang: "fr" | "en";
  view: "meals" | "shakes";
  kcal?: number;
  kcalMin?: number;
  kcalMax?: number;
  allergens: string[];
  dislikes: string[];
  baseQS: string;
  linkMeals: string;
  linkShakes: string;
  currentUrl: string;
  healthyPick: RecipeCardData[];
  shakesPick: RecipeCardData[];
  saved: SavedItem[];
  applyFiltersAction: (formData: FormData) => void | Promise<void>;
  saveRecipeAction: (formData: FormData) => void | Promise<void>;
  removeRecipeAction: (formData: FormData) => void | Promise<void>;
};

export default function RecipesClient(props: Props) {
  const {
    lang,
    view,
    kcal,
    kcalMin,
    kcalMax,
    allergens,
    dislikes,
    baseQS,
    linkMeals,
    linkShakes,
    currentUrl,
    healthyPick,
    shakesPick,
    saved,
    applyFiltersAction,
    saveRecipeAction,
    removeRecipeAction,
  } = props;

  const { t } = useLanguage();

  const hasKcalTarget = typeof kcal === "number";
  const hasKcalMin = typeof kcalMin === "number";
  const hasKcalMax = typeof kcalMax === "number";

  const savedSet = new Set(saved.map((s) => s.id));

  return (
    <>
      <div className="h-10" aria-hidden="true" />

      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="page-header">
          <div>
            <h1
              className="h1"
              style={{
                marginBottom: 2,
                fontSize: "clamp(20px, 2.2vw, 24px)",
                lineHeight: 1.15,
              }}
            >
              {t("recipes.pageTitle")}
            </h1>
            <p
              className="lead"
              style={{
                marginTop: 4,
                fontSize: "clamp(12px, 1.6vw, 14px)",
                lineHeight: 1.35,
                color: "#4b5563",
              }}
            >
              {t("recipes.pageSubtitle")} <strong>IA</strong>
            </p>

            {/* Récap filtres actifs */}
            <div
              className="text-xs"
              style={{ color: "#6b7280", marginTop: 8 }}
            >
              {t("recipes.filters.activeLabel")}
              {hasKcalTarget && kcal !== undefined && (
                <>
                  {" "}
                  {t("recipes.filters.target")}: ~{kcal}{" "}
                  {t("recipes.filters.kcalSuffix")}
                </>
              )}
              {!hasKcalTarget &&
                (hasKcalMin || hasKcalMax) &&
                (kcalMin !== undefined || kcalMax !== undefined) && (
                  <>
                    {" "}
                    {t("recipes.filters.range")}:{" "}
                    {hasKcalMin && kcalMin !== undefined ? kcalMin : "…"}–
                    {hasKcalMax && kcalMax !== undefined ? kcalMax : "…"}{" "}
                    {t("recipes.filters.kcalSuffix")}
                  </>
                )}
              {allergens.length ? (
                <>
                  {" "}
                  · {t("recipes.filters.allergens")}:{" "}
                  {allergens.join(", ")}
                </>
              ) : null}
              {dislikes.length ? (
                <>
                  {" "}
                  · {t("recipes.filters.dislikes")}:{" "}
                  {dislikes.join(", ")}
                </>
              ) : null}
              {!hasKcalTarget &&
                !hasKcalMin &&
                !hasKcalMax &&
                !allergens.length &&
                !dislikes.length &&
                ` ${t("recipes.filters.none")}`}
            </div>
          </div>
        </div>

        {/* =================== Choix rapide (blocs cliquables) =================== */}
        <div
          className="grid gap-4 sm:grid-cols-2"
          style={{ marginTop: 12 }}
        >
          <a
            href={linkMeals}
            className="card"
            style={{
              textDecoration: "none",
              color: "inherit",
              borderColor: view === "meals" ? "#111" : undefined,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{t("recipes.quickSwitch.meals.title")}</strong>
                <div
                  className="text-sm"
                  style={{ color: "#6b7280" }}
                >
                  {t("recipes.quickSwitch.meals.subtitle")}
                </div>
              </div>
              {view === "meals" && (
                <span className="badge">
                  {t("recipes.quickSwitch.activeBadge")}
                </span>
              )}
            </div>
          </a>

          <a
            href={linkShakes}
            className="card"
            style={{
              textDecoration: "none",
              color: "inherit",
              borderColor: view === "shakes" ? "#111" : undefined,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{t("recipes.quickSwitch.shakes.title")}</strong>
                <div
                  className="text-sm"
                  style={{ color: "#6b7280" }}
                >
                  {t("recipes.quickSwitch.shakes.subtitle")}
                </div>
              </div>
              {view === "shakes" && (
                <span className="badge">
                  {t("recipes.quickSwitch.activeBadge")}
                </span>
              )}
            </div>
          </a>
        </div>

        {/* =================== Contraintes & filtres (pour IA) =================== */}
        <div className="section" style={{ marginTop: 12 }}>
          <div
            className="section-head"
            style={{
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(16px,1.9vw,18px)",
                lineHeight: 1.2,
              }}
            >
              {t("recipes.constraints.title")}
            </h2>
          </div>

          <form
            action={applyFiltersAction}
            className="grid gap-6 lg:grid-cols-2"
          >
            {/* On garde la vue actuelle (meals/shakes) */}
            <input type="hidden" name="view" value={view} />

            <fieldset style={{ display: "contents" }}>
              <div>
                <label className="label">
                  {t("recipes.constraints.kcalTargetLabel")}
                </label>
                <input
                  className="input"
                  type="number"
                  name="kcal"
                  placeholder="ex: 600"
                  defaultValue={
                    hasKcalTarget && kcal !== undefined ? String(kcal) : ""
                  }
                />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="label">
                    {t("recipes.constraints.kcalMinLabel")}
                  </label>
                  <input
                    className="input"
                    type="number"
                    name="kcalMin"
                    placeholder="ex: 450"
                    defaultValue={
                      hasKcalMin && kcalMin !== undefined
                        ? String(kcalMin)
                        : ""
                    }
                  />
                </div>
                <div>
                  <label className="label">
                    {t("recipes.constraints.kcalMaxLabel")}
                  </label>
                  <input
                    className="input"
                    type="number"
                    name="kcalMax"
                    placeholder="ex: 700"
                    defaultValue={
                      hasKcalMax && kcalMax !== undefined
                        ? String(kcalMax)
                        : ""
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  {t("recipes.constraints.allergensLabel")}
                </label>
                <input
                  className="input"
                  type="text"
                  name="allergens"
                  placeholder={t(
                    "recipes.constraints.allergensPlaceholder",
                  )}
                  defaultValue={allergens.join(", ")}
                />
              </div>

              <div>
                <label className="label">
                  {t("recipes.constraints.dislikesLabel")}
                </label>
                <input
                  className="input"
                  type="text"
                  name="dislikes"
                  placeholder={t(
                    "recipes.constraints.dislikesPlaceholder",
                  )}
                  defaultValue={dislikes.join(", ")}
                />
                <div
                  className="text-xs"
                  style={{ color: "#6b7280", marginTop: 4 }}
                >
                  {t("recipes.constraints.dislikesHelp")}
                </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-between lg:col-span-2">
              <div
                className="text-sm"
                style={{ color: "#6b7280" }}
              >
                {t("recipes.constraints.footerNote")}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  href="/dashboard/recipes"
                  className="btn btn-outline"
                  style={{ color: "#111" }}
                >
                  {t("recipes.constraints.resetButton")}
                </a>
                <button className="btn btn-dash" type="submit">
                  {t("recipes.constraints.regenerateButton")}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Vos recettes enregistrées */}
        {saved.length > 0 && (
          <section
            className="section"
            style={{ marginTop: 12 }}
          >
            <div
              className="section-head"
              style={{ marginBottom: 8 }}
            >
              <h2>{t("recipes.saved.title")}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              {saved.map((s) => (
                <article
                  key={s.id}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <a
                    href={`/dashboard/recipes/${s.id}`}
                    className="font-semibold"
                    style={{
                      textDecoration: "none",
                      color: "var(--text,#111)",
                    }}
                  >
                    {s.title}
                  </a>
                  <form action={removeRecipeAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={currentUrl || "/dashboard/recipes"}
                    />
                    <button
                      type="submit"
                      className="btn btn-outline"
                      style={{ color: "var(--text, #111)" }}
                    >
                      {t("recipes.saved.removeButton")}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* =================== CONTENU selon view =================== */}
        {view === "meals" ? (
          <>
            <section
              className="section"
              style={{ marginTop: 12 }}
            >
              <div
                className="section-head"
                style={{ marginBottom: 8 }}
              >
                <h2>{t("recipes.mealsSection.title")}</h2>
                <p
                  className="text-xs"
                  style={{ color: "#6b7280", marginTop: 4 }}
                >
                  {t("recipes.mealsSection.subtitle")}
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                {healthyPick.map((r) => (
                  <Card
                    key={r.id}
                    r={r}
                    isSaved={savedSet.has(r.id)}
                    currentUrl={currentUrl || "/dashboard/recipes"}
                    saveRecipeAction={saveRecipeAction}
                    removeRecipeAction={removeRecipeAction}
                  />
                ))}
              </div>
            </section>

            {/* Suggestions IA en plus */}
            <AIExtraSection
              kind="meals"
              baseQS={baseQS}
              kcal={kcal}
              kcalMin={kcalMin}
              kcalMax={kcalMax}
              allergens={allergens}
              dislikes={dislikes}
            />
          </>
        ) : (
          <>
            <section
              className="section"
              style={{ marginTop: 12 }}
            >
              <div
                className="section-head"
                style={{ marginBottom: 8 }}
              >
                <h2>{t("recipes.shakesSection.title")}</h2>
                <p
                  className="text-xs"
                  style={{ color: "#6b7280", marginTop: 4 }}
                >
                  {t("recipes.shakesSection.subtitle")}
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                {shakesPick.map((r) => (
                  <Card
                    key={r.id}
                    r={r}
                    isSaved={savedSet.has(r.id)}
                    currentUrl={currentUrl || "/dashboard/recipes"}
                    saveRecipeAction={saveRecipeAction}
                    removeRecipeAction={removeRecipeAction}
                  />
                ))}
              </div>
            </section>

            {/* Suggestions IA en plus */}
            <AIExtraSection
              kind="shakes"
              baseQS={baseQS}
              kcal={kcal}
              kcalMin={kcalMin}
              kcalMax={kcalMax}
              allergens={allergens}
              dislikes={dislikes}
            />
          </>
        )}
      </div>
    </>
  );
}

/* ===================== Carte Recette (base) ===================== */
function Card({
  r,
  isSaved,
  currentUrl,
  saveRecipeAction,
  removeRecipeAction,
}: {
  r: RecipeCardData;
  isSaved: boolean;
  currentUrl: string;
  saveRecipeAction: (formData: FormData) => void | Promise<void>;
  removeRecipeAction: (formData: FormData) => void | Promise<void>;
}) {
  const { t } = useLanguage();
  const href = `/dashboard/recipes/${r.id}${r.detailQS}`;

  return (
    <article className="card" style={{ overflow: "hidden" }}>
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

        {isSaved ? (
          <form action={removeRecipeAction}>
            <input type="hidden" name="id" value={r.id} />
            <input
              type="hidden"
              name="returnTo"
              value={currentUrl}
            />
            <button
              type="submit"
              className="btn btn-outline"
              style={{ color: "var(--text, #111)" }}
            >
              {t("recipes.card.savedRemove")}
            </button>
          </form>
        ) : (
          <form action={saveRecipeAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="title" value={r.title} />
            <input
              type="hidden"
              name="returnTo"
              value={currentUrl}
            />
            <button
              type="submit"
              className="btn btn-outline"
              style={{ color: "var(--text, #111)" }}
            >
              {t("recipes.card.save")}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
