import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AIExtraSection } from "./AISection";

/* ===================== Config Next ===================== */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  return raw.split(/[,|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
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
  return seededShuffle(arr, seed).slice(0, Math.max(0, Math.min(n, arr.length)));
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

/* ---- dictionnaire "re-travailler" pour plus tard ---- */
const REWORK_TIPS: Record<string, string[]> = {
  brocoli: ["Rôti au four parmesan-citron", "Wok soja-sésame", "Velouté crème légère"],
  saumon: ["Mariné miso/soja", "Papillote citron-aneth", "Rillettes au yaourt"],
  tofu: ["Mariné puis snacké", "Panure maïzena + sauce douce", "Émietté façon brouillade"],
  poivron: ["Confit puis pelé", "Coulis doux", "Grillé salade"],
  champignons: ["Poêlés très chauds", "Hachés en bolo", "Rôtis entiers"],
  courgette: ["Tagliatelles ail-citron", "Gratin ricotta-menthe", "Galettes râpées"],
  épinards: ["Sautés minute", "Pesto doux", "Fondue légère"],
  lentilles: ["Dal coco", "Salade tiède", "Soupe carotte-cumin"],
};

/* ---- base healthy (dispo pour tous) ---- */
const HEALTHY_BASE: Recipe[] = [
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
    ingredients: ["œufs", "champignons", "ciboulette", "beurre", "sel", "poivre", "parmesan"],
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

/* ---- base Bar à prot' ---- */
const SHAKES_BASE: Recipe[] = [
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

/* ===================== Filtres (Server Action) ===================== */
async function applyFiltersAction(formData: FormData): Promise<void> {
  "use server";
  const params = new URLSearchParams();
  const fields = ["kcal", "kcalMin", "kcalMax", "allergens", "dislikes", "view"] as const;
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
      ? arr.filter((x) => x && typeof x.id === "string" && typeof x.title === "string")
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
  const kcal = Number(searchParams?.kcal ?? "");
  const kcalMin = Number(searchParams?.kcalMin ?? "");
  const kcalMax = Number(searchParams?.kcalMax ?? "");
  const allergens = parseCsv(searchParams?.allergens);
  const dislikes = parseCsv(searchParams?.dislikes);

  const hasKcalTarget = !isNaN(kcal) && kcal > 0;
  const hasKcalMin = !isNaN(kcalMin) && kcalMin > 0;
  const hasKcalMax = !isNaN(kcalMax) && kcalMax > 0;

  const view = (searchParams?.view === "shakes" ? "shakes" : "meals") as "meals" | "shakes";

  const seed = Number(searchParams?.rnd ?? "0") || 123456789;

  const healthyPick = pickRandomSeeded(HEALTHY_BASE, 6, seed);
  const shakesPick = pickRandomSeeded(SHAKES_BASE, 6, seed + 7);

  // QS gardés (sans view)
  const qsParts: string[] = [];
  if (hasKcalTarget) qsParts.push(`kcal=${kcal}`);
  if (hasKcalMin) qsParts.push(`kcalMin=${kcalMin}`);
  if (hasKcalMax) qsParts.push(`kcalMax=${kcalMax}`);
  if (allergens.length) qsParts.push(`allergens=${encodeURIComponent(allergens.join(","))}`);
  if (dislikes.length) qsParts.push(`dislikes=${encodeURIComponent(dislikes.join(","))}`);
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
              Recettes
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
              Base healthy pour tous + suggestions <strong>perso IA</strong> selon tes filtres.
            </p>

            {/* Récap filtres actifs */}
            <div className="text-xs" style={{ color: "#6b7280", marginTop: 8 }}>
              Filtres actifs —
              {hasKcalTarget && <> cible: ~{kcal} kcal</>}
              {!hasKcalTarget && (hasKcalMin || hasKcalMax) && (
                <>
                  {" "}
                  plage: {hasKcalMin ? kcalMin : "…"}–{hasKcalMax ? kcalMax : "…"} kcal
                </>
              )}
              {allergens.length ? <> · allergènes: {allergens.join(", ")}</> : null}
              {dislikes.length ? <> · non aimés: {dislikes.join(", ")}</> : null}
              {!hasKcalTarget &&
                !hasKcalMin &&
                !hasKcalMax &&
                !allergens.length &&
                !dislikes.length &&
                " aucun"}
            </div>
          </div>
        </div>

        {/* =================== Choix rapide (blocs cliquables) =================== */}
        <div className="grid gap-4 sm:grid-cols-2" style={{ marginTop: 12 }}>
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
                <strong>Recettes — Healthy</strong>
                <div className="text-sm" style={{ color: "#6b7280" }}>
                  Plats + bowls healthy
                </div>
              </div>
              {view === "meals" && <span className="badge">Actif</span>}
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
                <strong>Bar à prot’ — Boissons protéinées</strong>
                <div className="text-sm" style={{ color: "#6b7280" }}>
                  Shakes/smoothies en 5 min
                </div>
              </div>
              {view === "shakes" && <span className="badge">Actif</span>}
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
              Contraintes & filtres (pour l&apos;IA)
            </h2>
          </div>

          <form action={applyFiltersAction} className="grid gap-6 lg:grid-cols-2">
            {/* On garde la vue actuelle (meals/shakes) */}
            <input type="hidden" name="view" value={view} />

            <fieldset style={{ display: "contents" }}>
              <div>
                <label className="label">Cible calories (kcal)</label>
                <input
                  className="input"
                  type="number"
                  name="kcal"
                  placeholder="ex: 600"
                  defaultValue={!isNaN(kcal) && kcal > 0 ? String(kcal) : ""}
                />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="label">Min kcal</label>
                  <input
                    className="input"
                    type="number"
                    name="kcalMin"
                    placeholder="ex: 450"
                    defaultValue={!isNaN(kcalMin) && kcalMin > 0 ? String(kcalMin) : ""}
                  />
                </div>
                <div>
                  <label className="label">Max kcal</label>
                  <input
                    className="input"
                    type="number"
                    name="kcalMax"
                    placeholder="ex: 700"
                    defaultValue={!isNaN(kcalMax) && kcalMax > 0 ? String(kcalMax) : ""}
                  />
                </div>
              </div>

              <div>
                <label className="label">Allergènes / intolérances (séparés par virgules)</label>
                <input
                  className="input"
                  type="text"
                  name="allergens"
                  placeholder="arachide, lactose, gluten"
                  defaultValue={allergens.join(", ")}
                />
              </div>

              <div>
                <label className="label">Aliments non aimés (re-travailler)</label>
                <input
                  className="input"
                  type="text"
                  name="dislikes"
                  placeholder="brocoli, saumon, tofu..."
                  defaultValue={dislikes.join(", ")}
                />
                <div className="text-xs" style={{ color: "#6b7280", marginTop: 4 }}>
                  L&apos;IA les garde, mais propose une autre façon de les cuisiner.
                </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-between lg:col-span-2">
              <div className="text-sm" style={{ color: "#6b7280" }}>
                Les filtres s&apos;appliquent surtout aux suggestions <strong>perso IA</strong>.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a href="/dashboard/recipes" className="btn btn-outline" style={{ color: "#111" }}>
                  Réinitialiser
                </a>
                <button className="btn btn-dash" type="submit">
                  Régénérer
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Vos recettes enregistrées */}
        {saved.length > 0 && (
          <section className="section" style={{ marginTop: 12 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <h2>Vos recettes enregistrées</h2>
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
                      Retirer
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
            <section className="section" style={{ marginTop: 12 }}>
              <div className="section-head" style={{ marginBottom: 8 }}>
                <h2>Plats & bowls — base healthy</h2>
                <p className="text-xs" style={{ color: "#6b7280", marginTop: 4 }}>
                  Recettes fixes, stables et testées.
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                {healthyPick.map((r) => (
                  <Card
                    key={r.id}
                    r={r}
                    detailQS={encode(r)}
                    isSaved={savedSet.has(r.id)}
                    currentUrl={currentUrl || "/dashboard/recipes"}
                  />
                ))}
              </div>
            </section>

            {/* Suggestions IA en plus */}
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
            <section className="section" style={{ marginTop: 12 }}>
              <div className="section-head" style={{ marginBottom: 8 }}>
                <h2>Boissons protéinées — base</h2>
                <p className="text-xs" style={{ color: "#6b7280", marginTop: 4 }}>
                  Shakes & smoothies rapides.
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                {shakesPick.map((r) => (
                  <Card
                    key={r.id}
                    r={r}
                    detailQS={encode(r)}
                    isSaved={savedSet.has(r.id)}
                    currentUrl={currentUrl || "/dashboard/recipes"}
                  />
                ))}
              </div>
            </section>

            {/* Suggestions IA en plus */}
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
}: {
  r: Recipe;
  detailQS: string;
  isSaved: boolean;
  currentUrl: string;
}) {
  const href = `/dashboard/recipes/${r.id}${detailQS}`;
  const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
  const shown = ing.slice(0, 8);
  const more = Math.max(0, ing.length - shown.length);

  return (
    <article className="card" style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
      </div>

      <div
        className="text-sm"
        style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}
      >
        {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
        {typeof r.timeMin === "number" && <span className="badge">{r.timeMin} min</span>}
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

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <a className="btn btn-dash" href={href}>
          Voir la recette
        </a>

        {isSaved ? (
          <form action={removeRecipeAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="returnTo" value={currentUrl} />
            <button
              type="submit"
              className="btn btn-outline"
              style={{ color: "var(--text, #111)" }}
            >
              Enregistrée ✓ (Retirer)
            </button>
          </form>
        ) : (
          <form action={saveRecipeAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="title" value={r.title} />
            <input type="hidden" name="returnTo" value={currentUrl} />
            <button
              type="submit"
              className="btn btn-outline"
              style={{ color: "var(--text, #111)" }}
            >
              Enregistrer
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

