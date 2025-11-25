// apps/web/app/dashboard/recipes/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { translations } from "@/app/i18n/translations";
import RecipesClient from "./RecipesClient";

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

type RecipeCardData = Recipe & { detailQS: string };

type SavedItem = { id: string; title: string };

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

/* ---- base healthy EN ---- */
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

/* ===================== Sauvegarde via Cookie (Server Actions) ===================== */
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

/* ===================== Server Actions ===================== */
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

/* ===================== Page (server) ===================== */
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

  // Base selon la langue
  const healthyBase = lang === "en" ? HEALTHY_BASE_EN : HEALTHY_BASE_FR;
  const shakesBase = lang === "en" ? SHAKES_BASE_EN : SHAKES_BASE_FR;

  const healthyPickBase = pickRandomSeeded(healthyBase, 6, seed);
  const shakesPickBase = pickRandomSeeded(shakesBase, 6, seed + 7);

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

  const encodeRecipe = (r: Recipe) =>
    `?${baseQS}data=${encodeB64UrlJson(r)}`;

  const healthyPick: RecipeCardData[] = healthyPickBase.map((r) => ({
    ...r,
    detailQS: encodeRecipe(r),
  }));
  const shakesPick: RecipeCardData[] = shakesPickBase.map((r) => ({
    ...r,
    detailQS: encodeRecipe(r),
  }));

  // Lecture des recettes enregistrées (cookie)
  const saved = readSaved();
  const currentUrlParts = [...qsParts, `view=${view}`];
  const currentUrl = `/dashboard/recipes?${currentUrlParts.join("&")}`;

  // Liens nav bloc
  const linkMeals = `/dashboard/recipes?${baseQS}view=meals`;
  const linkShakes = `/dashboard/recipes?${baseQS}view=shakes`;

  return (
    <RecipesClient
      lang={lang}
      view={view}
      kcal={hasKcalTarget ? kcal : undefined}
      kcalMin={hasKcalMin ? kcalMin : undefined}
      kcalMax={hasKcalMax ? kcalMax : undefined}
      allergens={allergens}
      dislikes={dislikes}
      baseQS={baseQS}
      linkMeals={linkMeals}
      linkShakes={linkShakes}
      currentUrl={currentUrl}
      healthyPick={healthyPick}
      shakesPick={shakesPick}
      saved={saved}
      applyFiltersAction={applyFiltersAction}
      saveRecipeAction={saveRecipeAction}
      removeRecipeAction={removeRecipeAction}
    />
  );
}
