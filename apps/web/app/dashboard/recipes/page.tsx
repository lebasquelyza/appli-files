// apps/web/app/dashboard/recipes/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AIExtraSection } from "./AISection";
import { translations } from "@/app/i18n/translations";

/* ===================== Config Next ===================== */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ===================== i18n helpers (server) ===================== */
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
function parseCsv(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw
    .split(/[,|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/* --- random déterministe --- */
function seededPRNG(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = seededPRNG(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickRandomSeeded<T>(arr: T[], n: number, seed: number): T[] {
  return seededShuffle(arr, seed).slice(
    0,
    Math.max(0, Math.min(n, arr.length)),
  );
}

/* ---- base64url JSON (côté serveur) ---- */
function encodeB64UrlJson(data: any): string {
  const json = JSON.stringify(data);
  const B: any = (globalThis as any).Buffer;

  if (typeof window === "undefined" && B?.from) {
    return B.from(json, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const btoaFn: ((s: string) => string) | undefined = (globalThis as any).btoa;
  let b64: string;
  if (typeof btoaFn === "function") b64 = btoaFn(bin);
  else if (B?.from) b64 = B.from(bin, "binary").toString("base64");
  else b64 = "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---- dictionnaire "re-travailler" pour plus tard (non utilisé ici) ---- */
const REWORK_TIPS: Record<string, string[]> = {
  brocoli: [
    "Rôti au four parmesan-citron",
    "Wok soja-sésame",
    "Velouté crème légère",
  ],
  saumon: [
    "Mariné miso/soja",
    "Papillote citron-aneth",
    "Rillettes au yaourt",
  ],
  tofu: [
    "Mariné puis snacké",
    "Panure maïzena + sauce douce",
    "Émietté façon brouillade",
  ],
  poivron: ["Confit puis pelé", "Coulis doux", "Grillé salade"],
  champignons: ["Poêlés très chauds", "Hachés en bolo", "Rôtis entiers"],
  courgette: [
    "Tagliatelles ail-citron",
    "Gratin ricotta-menthe",
    "Galettes râpées",
  ],
  épinards: ["Sautés minute", "Pesto doux", "Fondue légère"],
  lentilles: ["Dal coco", "Salade tiède", "Soupe carotte-cumin"],
};

/* ---- base healthy FR ---- */
const HEALTHY_BASE_FR: Recipe[] = [
  {
    id: "salade-quinoa",
    title: "Salade de quinoa croquante",
    subtitle: "Pois chiches, concombre, citron",
    kcal: 520,
    timeMin: 15,
    tags: ["végétarien", "sans-gluten"],
    goals: ["equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "quinoa",
      "pois chiches",
      "concombre",
      "citron",
      "huile d'olive",
      "sel",
      "poivre",
      "persil",
    ],
    steps: ["Rincer, cuire, assaisonner"],
  },
  {
    id: "bowl-poulet-riz",
    title: "Bowl poulet & riz complet",
    subtitle: "Avocat, maïs, yaourt grec",
    kcal: 640,
    timeMin: 20,
    tags: ["protéiné"],
    goals: ["prise de masse", "equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "poulet",
      "riz complet",
      "avocat",
      "maïs",
      "yaourt grec",
      "cumin",
      "citron",
      "sel",
      "poivre",
    ],
    steps: ["Cuire riz, saisir poulet, assembler"],
  },
  {
    id: "omelette-herbes",
    title: "Omelette champignons & fines herbes",
    subtitle: "Rapide du matin",
    kcal: 420,
    timeMin: 10,
    tags: ["rapide", "sans-gluten"],
    goals: ["equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "œufs",
      "champignons",
      "ciboulette",
      "beurre",
      "sel",
      "poivre",
      "parmesan",
    ],
    steps: ["Battre, cuire, plier"],
  },
  {
    id: "saumon-four",
    title: "Saumon au four & légumes rôtis",
    subtitle: "Carottes, brocoli, citron",
    kcal: 580,
    timeMin: 25,
    tags: ["omega-3", "sans-gluten"],
    goals: ["equilibre", "santé"],
    minPlan: "BASIC",
    ingredients: [
      "saumon",
      "brocoli",
      "carottes",
      "citron",
      "huile d'olive",
      "ail",
      "sel",
      "poivre",
    ],
    steps: ["Préchauffer, rôtir, servir"],
  },
  {
    id: "curry-chiche",
    title: "Curry de pois chiches coco",
    subtitle: "Vegan & réconfortant",
    kcal: 600,
    timeMin: 30,
    tags: ["vegan", "sans-gluten"],
    goals: ["equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "pois chiches",
      "lait de coco",
      "tomates concassées",
      "oignon",
      "ail",
      "curry",
      "riz basmati",
      "sel",
    ],
    steps: ["Suer, mijoter, servir"],
  },
  {
    id: "tofu-brocoli-wok",
    title: "Tofu sauté au brocoli (wok)",
    subtitle: "Sauce soja-sésame",
    kcal: 530,
    timeMin: 15,
    tags: ["vegan", "rapide"],
    goals: ["sèche", "equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "tofu ferme",
      "brocoli",
      "sauce soja",
      "ail",
      "gingembre",
      "graines de sésame",
      "huile",
      "maïzena",
    ],
    steps: ["Saisir, lier, napper"],
  },
];

/* ---- base healthy EN (mêmes id, valeurs, mais titres traduits) ---- */
const HEALTHY_BASE_EN: Recipe[] = [
  {
    id: "salade-quinoa",
    title: "Crunchy quinoa salad",
    subtitle: "Chickpeas, cucumber, lemon",
    kcal: 520,
    timeMin: 15,
    tags: ["vegetarian", "gluten-free"],
    goals: ["balance"],
    minPlan: "BASIC",
    ingredients: [
      "quinoa",
      "chickpeas",
      "cucumber",
      "lemon",
      "olive oil",
      "salt",
      "pepper",
      "parsley",
    ],
    steps: ["Rinse, cook, season"],
  },
  {
    id: "bowl-poulet-riz",
    title: "Chicken & brown rice bowl",
    subtitle: "Avocado, corn, greek yogurt",
    kcal: 640,
    timeMin: 20,
    tags: ["high-protein"],
    goals: ["muscle gain", "balance"],
    minPlan: "BASIC",
    ingredients: [
      "chicken",
      "brown rice",
      "avocado",
      "corn",
      "greek yogurt",
      "cumin",
      "lemon",
      "salt",
      "pepper",
    ],
    steps: ["Cook rice, sear chicken, assemble"],
  },
  {
    id: "omelette-herbes",
    title: "Mushroom & herb omelette",
    subtitle: "Quick breakfast",
    kcal: 420,
    timeMin: 10,
    tags: ["quick", "gluten-free"],
    goals: ["balance"],
    minPlan: "BASIC",
    ingredients: [
      "eggs",
      "mushrooms",
      "chives",
      "butter",
      "salt",
      "pepper",
      "parmesan",
    ],
    steps: ["Whisk, cook, fold"],
  },
  {
    id: "saumon-four",
    title: "Baked salmon & roasted veggies",
    subtitle: "Carrots, broccoli, lemon",
    kcal: 580,
    timeMin: 25,
    tags: ["omega-3", "gluten-free"],
    goals: ["balance", "health"],
    minPlan: "BASIC",
    ingredients: [
      "salmon",
      "broccoli",
      "carrots",
      "lemon",
      "olive oil",
      "garlic",
      "salt",
      "pepper",
    ],
    steps: ["Preheat, roast, serve"],
  },
  {
    id: "curry-chiche",
    title: "Coconut chickpea curry",
    subtitle: "Vegan & comforting",
    kcal: 600,
    timeMin: 30,
    tags: ["vegan", "gluten-free"],
    goals: ["balance"],
    minPlan: "BASIC",
    ingredients: [
      "chickpeas",
      "coconut milk",
      "crushed tomatoes",
      "onion",
      "garlic",
      "curry",
      "basmati rice",
      "salt",
    ],
    steps: ["Sauté, simmer, serve"],
  },
  {
    id: "tofu-brocoli-wok",
    title: "Stir-fried tofu & broccoli",
    subtitle: "Soy-sesame sauce",
    kcal: 530,
    timeMin: 15,
    tags: ["vegan", "quick"],
    goals: ["cutting", "balance"],
    minPlan: "BASIC",
    ingredients: [
      "firm tofu",
      "broccoli",
      "soy sauce",
      "garlic",
      "ginger",
      "sesame seeds",
      "oil",
      "cornstarch",
    ],
    steps: ["Sear, thicken, coat"],
  },
];

/* ---- base Bar à prot' FR ---- */
const SHAKES_BASE_FR: Recipe[] = [
  {
    id: "shake-choco-banane",
    title: "Choco-banane protéiné",
    subtitle: "Lait, whey chocolat",
    kcal: 360,
    timeMin: 5,
    tags: ["shake", "rapide"],
    goals: ["prise de masse", "equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "banane",
      "lait (ou végétal)",
      "whey chocolat",
      "beurre de cacahuète",
      "glaçons",
    ],
    steps: ["Mixer 30–40 s", "Servir bien frais"],
  },
  {
    id: "shake-vanille-cafe",
    title: "Vanille café frappé",
    subtitle: "Skyr, vanille",
    kcal: 280,
    timeMin: 5,
    tags: ["shake", "café"],
    goals: ["sèche", "equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "skyr",
      "lait (ou végétal)",
      "expresso froid",
      "vanille",
      "édulcorant (option)",
      "glaçons",
    ],
    steps: ["Verser au blender", "Mixer et déguster"],
  },
  {
    id: "shake-fruits-rouges",
    title: "Fruits rouges & yaourt grec",
    subtitle: "Frais & onctueux",
    kcal: 320,
    timeMin: 5,
    tags: ["shake", "fruité"],
    goals: ["equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "yaourt grec 0%",
      "lait (ou végétal)",
      "fruits rouges surgelés",
      "whey neutre",
      "miel (option)",
    ],
    steps: ["Mixer fin", "Goûter et ajuster"],
  },
  {
    id: "shake-tropical",
    title: "Tropical coco",
    subtitle: "Mangue, coco",
    kcal: 340,
    timeMin: 5,
    tags: ["shake", "fruité"],
    goals: ["equilibre"],
    minPlan: "BASIC",
    ingredients: [
      "lait de coco léger",
      "mangue",
      "ananas",
      "whey neutre ou pois",
      "citron vert",
    ],
    steps: ["Mixer 40 s", "Servir avec glaçons"],
  },
];

/* ---- base Bar à prot' EN ---- */
const SHAKES_BASE_EN: Recipe[] = [
  {
    id: "shake-choco-banane",
    title: "Chocolate banana shake",
    subtitle: "Milk, chocolate whey",
    kcal: 360,
    timeMin: 5,
    tags: ["shake", "quick"],
    goals: ["muscle gain", "balance"],
    minPlan: "BASIC",
    ingredients: [
      "banana",
      "milk (or plant-based)",
      "chocolate whey",
      "peanut butter",
      "ice cubes",
    ],
    steps: ["Blend 30–40 s", "Serve chilled"],
  },
  {
    id: "shake-vanille-cafe",
    title: "Vanilla coffee frappé",
    subtitle: "Skyr, vanilla",
    kcal: 280,
    timeMin: 5,
    tags: ["shake", "coffee"],
    goals: ["cutting", "balance"],
    minPlan: "BASIC",
    ingredients: [
      "skyr",
      "milk (or plant-based)",
      "cold espresso",
      "vanilla",
      "sweetener (optional)",
      "ice cubes",
    ],
    steps: ["Pour into blender", "Blend and enjoy"],
  },
  {
    id: "shake-fruits-rouges",
    title: "Berry & greek yogurt shake",
    subtitle: "Fresh & creamy",
    kcal: 320,
    timeMin: 5,
    tags: ["shake", "fruity"],
    goals: ["balance"],
    minPlan: "BASIC",
    ingredients: [
      "0% greek yogurt",
      "milk (or plant-based)",
      "frozen berries",
      "neutral whey",
      "honey (optional)",
    ],
    steps: ["Blend until smooth", "Taste and adjust"],
  },
  {
    id: "shake-tropical",
    title: "Tropical coconut shake",
    subtitle: "Mango, coconut",
    kcal: 340,
    timeMin: 5,
    tags: ["shake", "fruity"],
    goals: ["balance"],
    minPlan: "BASIC",
    ingredients: [
      "light coconut milk",
      "mango",
      "pineapple",
      "neutral or pea protein",
      "lime",
    ],
    steps: ["Blend 40 s", "Serve with ice"],
  },
];

/* ===================== Filtres (Server Action) ===================== */
async function applyFiltersAction(formData: FormData): Promise<void> {
  "use server";
  const params = new URLSearchParams();
  const fields = [
    "kcal",
    "kcalMin",
    "kcalMax",
    "allergens",
    "dislikes",
    "view",
  ] as const;
  for (const f of fields) {
    const val = (formData.get(f) ?? "").toString().trim();
    if (val) params.set(f, val);
  }
  params.set("rnd", String(Date.now()));
  redirect(`/dashboard/recipes?${params.toString()}`);
}

/* ===================== Sauvegarde via Cookie (Server Actions) ===================== */
type SavedItem = { id: string; title: string };
const SAVED_COOKIE = "saved_recipes_v1";

function readSaved(): SavedItem[] {
  try {
    const raw = cookies().get(SAVED_COOKIE)?.value ?? "[]";
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

function writeSaved(list: SavedItem[]) {
  cookies().set(SAVED_COOKIE, JSON.stringify(list), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function saveRecipeAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/dashboard/recipes");
  if (!id || !title) redirect(returnTo);

  const cur = readSaved();
  if (!cur.some((x) => x.id === id)) {
    cur.push({ id, title });
    writeSaved(cur);
  }
  redirect(returnTo);
}

async function removeRecipeAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/dashboard/recipes");
  if (!id) redirect(returnTo);

  const cur = readSaved().filter((x) => x.id !== id);
  writeSaved(cur);
  redirect(returnTo);
}

/* ===================== Page ===================== */
export default async function Page({
  searchParams,
}: {
  searchParams?: {
    kcal?: string;
    kcalMin?: string;
    kcalMax?: string;
    allergens?: string;
    dislikes?: string;
    rnd?: string;
    view?: string;
  };
}) {
  const lang = getLang();
  const t = (path: string, fallback?: string) => tServer(lang, path, fallback);

  const kcal = Number(searchParams?.kcal ?? "");
  const kcalMin = Number(searchParams?.kcalMin ?? "");
  const kcalMax = Number(searchParams?.kcalMax ?? "");
  const allergens = parseCsv(searchParams?.allergens);
  const dislikes = parseCsv(searchParams?.dislikes);

  const hasKcalTarget = !isNaN(kcal) && kcal > 0;
  const hasKcalMin = !isNaN(kcalMin) && kcalMin > 0;
  const hasKcalMax = !isNaN(kcalMax) && kcalMax > 0;

  const view = (searchParams?.view === "shakes" ? "shakes" : "meals") as
    | "meals"
    | "shakes";

  const seed = Number(searchParams?.rnd ?? "0") || 123456789;

  // 🔄 on choisit la base selon la langue (plus utilisée pour l'affichage fallback)
  const healthyBase = lang === "en" ? HEALTHY_BASE_EN : HEALTHY_BASE_FR;
  const shakesBase = lang === "en" ? SHAKES_BASE_EN : SHAKES_BASE_FR;

  // const healthyPick = pickRandomSeeded(healthyBase, 6, seed);
  // const shakesPick = pickRandomSeeded(shakesBase, 6, seed + 7);

  // QS gardés (sans view)
  const qsParts: string[] = [];
  if (hasKcalTarget) qsParts.push(`kcal=${kcal}`);
  if (hasKcalMin) qsParts.push(`kcalMin=${kcalMin}`);
  if (hasKcalMax) qsParts.push(`kcalMax=${kcalMax}`);
  if (allergens.length)
    qsParts.push(`allergens=${encodeURIComponent(allergens.join(","))}`);
  if (dislikes.length)
    qsParts.push(`dislikes=${encodeURIComponent(dislikes.join(","))}`);
  const baseQS = qsParts.length ? `${qsParts.join("&")}&` : "";
  const encode = (r: Recipe) => `?${baseQS}data=${encodeB64UrlJson(r)}`;

  // Lecture des recettes enregistrées (cookie)
  const saved = readSaved();
  const savedSet = new Set(saved.map((s) => s.id));
  const currentUrlParts = [...qsParts, `view=${view}`];
  const currentUrl = `/dashboard/recipes?${currentUrlParts.join("&")}`;

  // Liens nav bloc
  const linkMeals = `/dashboard/recipes?${baseQS}view=meals`;
  const linkShakes = `/dashboard/recipes?${baseQS}view=shakes`;

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
              {t("recipes.pageTitle", "Recettes")}
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
              {t(
                "recipes.pageSubtitle",
                "Base healthy pour tous + suggestions perso IA selon tes filtres.",
              )}{" "}
              <strong>IA</strong>
            </p>

            {/* Récap filtres actifs */}
            <div
              className="text-xs"
              style={{ color: "#6b7280", marginTop: 8 }}
            >
              {t("recipes.filters.activeLabel", "Filtres actifs —")}
              {hasKcalTarget && (
                <>
                  {" "}
                  {t("recipes.filters.target", "cible")}: ~{kcal}{" "}
                  {t("recipes.filters.kcalSuffix", "kcal")}
                </>
              )}
              {!hasKcalTarget && (hasKcalMin || hasKcalMax) && (
                <>
                  {" "}
                  {t("recipes.filters.range", "plage")}:{" "}
                  {hasKcalMin ? kcalMin : "…"}–{hasKcalMax ? kcalMax : "…"}{" "}
                  {t("recipes.filters.kcalSuffix", "kcal")}
                </>
              )}
              {allergens.length ? (
                <>
                  {" "}
                  · {t("recipes.filters.allergens", "allergènes")}:{" "}
                  {allergens.join(", ")}
                </>
              ) : null}
              {dislikes.length ? (
                <>
                  {" "}
                  · {t("recipes.filters.dislikes", "non aimés")}:{" "}
                  {dislikes.join(", ")}
                </>
              ) : null}
              {!hasKcalTarget &&
                !hasKcalMin &&
                !hasKcalMax &&
                !allergens.length &&
                !dislikes.length &&
                ` ${t("recipes.filters.none", "aucun")}`}
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
                <strong>
                  {t(
                    "recipes.quickSwitch.meals.title",
                    "Recettes — Healthy",
                  )}
                </strong>
                <div
                  className="text-sm"
                  style={{ color: "#6b7280" }}
                >
                  {t(
                    "recipes.quickSwitch.meals.subtitle",
                    "Plats + bowls healthy",
                  )}
                </div>
              </div>
              {view === "meals" && (
                <span className="badge">
                  {t("recipes.quickSwitch.activeBadge", "Actif")}
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
                <strong>
                  {t(
                    "recipes.quickSwitch.shakes.title",
                    "Bar à prot’ — Boissons protéinées",
                  )}
                </strong>
                <div
                  className="text-sm"
                  style={{ color: "#6b7280" }}
                >
                  {t(
                    "recipes.quickSwitch.shakes.subtitle",
                    "Shakes/smoothies en 5 min",
                  )}
                </div>
              </div>
              {view === "shakes" && (
                <span className="badge">
                  {t("recipes.quickSwitch.activeBadge", "Actif")}
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
              {t(
                "recipes.constraints.title",
                "Contraintes & filtres (pour l'IA)",
              )}
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
                  {t(
                    "recipes.constraints.kcalTargetLabel",
                    "Cible calories (kcal)",
                  )}
                </label>
                <input
                  className="input"
                  type="number"
                  name="kcal"
                  placeholder="ex: 600"
                  defaultValue={
                    !isNaN(kcal) && kcal > 0 ? String(kcal) : ""
                  }
                />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="label">
                    {t(
                      "recipes.constraints.kcalMinLabel",
                      "Min kcal",
                    )}
                  </label>
                  <input
                    className="input"
                    type="number"
                    name="kcalMin"
                    placeholder="ex: 450"
                    defaultValue={
                      !isNaN(kcalMin) && kcalMin > 0
                        ? String(kcalMin)
                        : ""
                    }
                  />
                </div>
                <div>
                  <label className="label">
                    {t(
                      "recipes.constraints.kcalMaxLabel",
                      "Max kcal",
                    )}
                  </label>
                  <input
                    className="input"
                    type="number"
                    name="kcalMax"
                    placeholder="ex: 700"
                    defaultValue={
                      !isNaN(kcalMax) && kcalMax > 0
                        ? String(kcalMax)
                        : ""
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  {t(
                    "recipes.constraints.allergensLabel",
                    "Allergènes / intolérances (séparés par virgules)",
                  )}
                </label>
                <input
                  className="input"
                  type="text"
                  name="allergens"
                  placeholder={t(
                    "recipes.constraints.allergensPlaceholder",
                    "arachide, lactose, gluten",
                  )}
                  defaultValue={allergens.join(", ")}
                />
              </div>

              <div>
                <label className="label">
                  {t(
                    "recipes.constraints.dislikesLabel",
                    "Aliments non aimés (re-travailler)",
                  )}
                </label>
                <input
                  className="input"
                  type="text"
                  name="dislikes"
                  placeholder={t(
                    "recipes.constraints.dislikesPlaceholder",
                    "brocoli, saumon, tofu...",
                  )}
                  defaultValue={dislikes.join(", ")}
                />
                <div
                  className="text-xs"
                  style={{ color: "#6b7280", marginTop: 4 }}
                >
                  {t(
                    "recipes.constraints.dislikesHelp",
                    "L'IA les garde, mais propose une autre façon de les cuisiner.",
                  )}
                </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-between lg:col-span-2">
              <div
                className="text-sm"
                style={{ color: "#6b7280" }}
              >
                {t(
                  "recipes.constraints.footerNote",
                  "Les filtres s'appliquent surtout aux suggestions perso IA.",
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  href="/dashboard/recipes"
                  className="btn btn-outline"
                  style={{ color: "#111" }}
                >
                  {t(
                    "recipes.constraints.resetButton",
                    "Réinitialiser",
                  )}
                </a>
                <button className="btn btn-dash" type="submit">
                  {t(
                    "recipes.constraints.regenerateButton",
                    "Régénérer",
                  )}
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
              <h2>
                {t(
                  "recipes.saved.title",
                  "Vos recettes enregistrées",
                )}
              </h2>
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
                      {t(
                        "recipes.saved.removeButton",
                        "Retirer",
                      )}
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
            <AIExtraSection
              kind="meals"
              baseQS={baseQS}
              kcal={hasKcalTarget ? kcal : undefined}
              kcalMin={hasKcalMin ? kcalMin : undefined}
              kcalMax={hasKcalMax ? kcalMax : undefined}
              allergens={allergens}
              dislikes={dislikes}
            />
          </>
        ) : (
          <>
            <AIExtraSection
              kind="shakes"
              baseQS={baseQS}
              kcal={hasKcalTarget ? kcal : undefined}
              kcalMin={hasKcalMin ? kcalMin : undefined}
              kcalMax={hasKcalMax ? kcalMax : undefined}
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
  detailQS,
  isSaved,
  currentUrl,
  t,
}: {
  r: Recipe;
  detailQS: string;
  isSaved: boolean;
  currentUrl: string;
  t: (path: string, fallback?: string) => string;
}) {
  const href = `/dashboard/recipes/${r.id}${detailQS}`;

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
          {t("recipes.card.viewRecipe", "Voir la recette")}
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
              {t(
                "recipes.card.savedRemove",
                "Enregistrée ✓ (Retirer)",
              )}
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
              {t("recipes.card.save", "Enregistrer")}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
