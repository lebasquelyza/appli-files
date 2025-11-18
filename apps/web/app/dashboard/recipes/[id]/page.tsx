//apps/web/app/dashboard/recipes/[id]/page.tsx
import { cookies } from "next/headers";
import { translations } from "@/app/i18n/translations";

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

/* ========== i18n helpers (server) ========== */
type Lang = "fr" | "en";

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function tServer(lang: Lang, path: string, fallback?: string): string {
  const dict = translations[lang] as any;
  const v = getFromPath(dict, path);
  if (typeof v === "string") return v;
  return fallback ?? path;
}

function getLang(): Lang {
  const cookieLang = cookies().get("fc-lang")?.value;
  if (cookieLang === "en") return "en";
  return "fr";
}

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
    if (typeof atobFn === "function") bin = atobFn(b64);
    else if (B?.from) bin = B.from(b64, "base64").toString("binary");
    else bin = "";
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* ---- Normalise ---- */
function normalizeRecipe(raw: any, forcedId: string) {
  const title = String(raw?.title ?? "").trim();
  if (!title) return null;
  const arrRework: Rework[] = Array.isArray(raw?.rework)
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
    ingredients: Array.isArray(raw?.ingredients)
      ? raw.ingredients.map((x: any) => String(x))
      : [],
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
  const lang = getLang();
  const t = (path: string, fallback?: string) => tServer(lang, path, fallback);

  const raw = searchParams?.data ? b64urlToJson<any>(searchParams.data) : null;
  const r = raw ? normalizeRecipe(raw, params.id) : null;

  if (!r) {
    return (
      <>
        {/* spacer topbar fixe */}
        <div className="h-10" aria-hidden="true" />
        <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
          <div className="section" style={{ marginTop: 12 }}>
            <h2
              style={{
                marginTop: 0,
                fontSize: "clamp(16px,1.9vw,18px)",
                lineHeight: 1.2,
              }}
            >
              {t("recipes.detail.notFound.title", "Recette introuvable")}
            </h2>
            <p>
              {t(
                "recipes.detail.notFound.description",
                "Ouvrez la fiche depuis la liste des recettes."
              )}
            </p>
            <a href="/dashboard/recipes" className="btn btn-dash">
              {t("recipes.detail.notFound.back", "← Retour aux recettes")}
            </a>
          </div>
        </div>
      </>
    );
  }

  const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps : [];
  const hasRework = Array.isArray(r.rework) && r.rework.length > 0;

  return (
    <>
      {/* spacer topbar fixe */}
      <div className="h-10" aria-hidden="true" />

      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="page-header">
          <div>
            {/* titres plus petits + responsives */}
            <h1
              className="h1"
              style={{
                marginBottom: 2,
                fontSize: "clamp(20px, 2.2vw, 24px)",
                lineHeight: 1.15,
              }}
            >
              {r.title}
            </h1>
            {r.subtitle && (
              <p
                className="lead"
                style={{
                  marginTop: 4,
                  fontSize: "clamp(12px, 1.6vw, 14px)",
                  lineHeight: 1.35,
                  color: "#4b5563",
                }}
              >
                {r.subtitle}
              </p>
            )}
          </div>
          <div
            className="text-sm"
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            {typeof r.kcal === "number" && (
              <span className="badge">{r.kcal} kcal</span>
            )}
            {typeof r.timeMin === "number" && (
              <span className="badge">{r.timeMin} min</span>
            )}
            <span className="badge">{r.minPlan}</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="card">
            <h3 style={{ marginTop: 0 }}>
              {t("recipes.detail.ingredients.title", "Ingrédients")}
            </h3>
            {ing.length ? (
              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                {ing.map((i, k) => (
                  <li key={k}>{i}</li>
                ))}
              </ul>
            ) : (
              <p
                className="text-sm"
                style={{ color: "#6b7280" }}
              >
                {t(
                  "recipes.detail.ingredients.empty",
                  "Pas d’ingrédients détaillés."
                )}
              </p>
            )}
          </article>

          <article className="card">
            <h3 style={{ marginTop: 0 }}>
              {t("recipes.detail.steps.title", "Préparation")}
            </h3>
            {steps.length ? (
              <ol style={{ marginTop: 6, paddingLeft: 18 }}>
                {steps.map((s, k) => (
                  <li key={k}>{s}</li>
                ))}
              </ol>
            ) : (
              <p
                className="text-sm"
                style={{ color: "#6b7280" }}
              >
                {t(
                  "recipes.detail.steps.empty",
                  "Pas d’étapes détaillées."
                )}
              </p>
            )}
          </article>
        </div>

        {/* Re-travailler */}
        {hasRework && (
          <article className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>
              {t(
                "recipes.detail.rework.title",
                "Re-travailler les aliments non aimés"
              )}
            </h3>
            <p
              className="text-sm"
              style={{ color: "#6b7280", marginTop: -4 }}
            >
              {t(
                "recipes.detail.rework.description",
                "On garde le produit et on propose d’autres façons de le cuisiner :"
              )}
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {r.rework!.map((rw, idx) => (
                <div key={idx} className="text-sm">
                  <strong style={{ textTransform: "capitalize" }}>
                    {rw.ingredient}
                  </strong>
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    {rw.tips.map((tTip, k) => (
                      <li key={k}>{tTip}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        )}

        <div style={{ marginTop: 16 }}>
          <a
            className="btn btn-outline"
            href="/dashboard/recipes"
            style={{ color: "var(--text, #111)" }}
          >
            {t("recipes.detail.back", "← Retour")}
          </a>
        </div>
      </div>
    </>
  );
}
