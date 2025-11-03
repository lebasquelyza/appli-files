
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

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
function planRank(p?: Plan) { return p === "PREMIUM" ? 3 : p === "PLUS" ? 2 : 1; }
function isUnlocked(r: Recipe, userPlan: Plan) { return planRank(userPlan) >= planRank(r.minPlan); }
function parseCsv(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw.split(/[,|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/* --- random déterministe --- */
function seededPRNG(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = seededPRNG(seed); const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickRandomSeeded<T>(arr: T[], n: number, seed: number): T[] {
  return seededShuffle(arr, seed).slice(0, Math.max(0, Math.min(n, arr.length)));
}

/* ---- base64url JSON ---- */
function encodeB64UrlJson(data: any): string {
  const json = JSON.stringify(data);
  const B: any = (globalThis as any).Buffer;

  if (typeof window === "undefined" && B?.from) {
    return B.from(json, "utf8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
  }
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const btoaFn: ((s: string) => string) | undefined = (globalThis as any).btoa;
  let b64: string;
  if (typeof btoaFn === "function") b64 = btoaFn(bin);
  else if (B?.from) b64 = B.from(bin, "binary").toString("base64");
  else b64 = "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
}

/* ---- dictionnaire "re-travailler" (fallback) ---- */
const REWORK_TIPS: Record<string, string[]> = {
  "brocoli": ["Rôti au four parmesan-citron", "Wok soja-sésame", "Velouté crème légère"],
  "saumon": ["Mariné miso/soja", "Papillote citron-aneth", "Rillettes au yaourt"],
  "tofu": ["Mariné puis snacké", "Panure maïzena + sauce douce", "Émietté façon brouillade"],
  "poivron": ["Confit puis pelé", "Coulis doux", "Grillé salade"],
  "champignons": ["Poêlés très chauds", "Hachés en bolo", "Rôtis entiers"],
  "courgette": ["Tagliatelles ail-citron", "Gratin ricotta-menthe", "Galettes râpées"],
  "épinards": ["Sautés minute", "Pesto doux", "Fondue légère"],
  "lentilles": ["Dal coco", "Salade tiède", "Soupe carotte-cumin"],
};

/* ---- base healthy (dispo pour tous) ---- */
const HEALTHY_BASE: Recipe[] = [
  { id:"salade-quinoa", title:"Salade de quinoa croquante", subtitle:"Pois chiches, concombre, citron",
    kcal:520, timeMin:15, tags:["végétarien","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
    ingredients:["quinoa","pois chiches","concombre","citron","huile d'olive","sel","poivre","persil"], steps:["Rincer, cuire, assaisonner"] },
  { id:"bowl-poulet-riz", title:"Bowl poulet & riz complet", subtitle:"Avocat, maïs, yaourt grec",
    kcal:640, timeMin:20, tags:["protéiné"], goals:["prise de masse","equilibre"], minPlan:"BASIC",
    ingredients:["poulet","riz complet","avocat","maïs","yaourt grec","cumin","citron","sel","poivre"], steps:["Cuire riz, saisir poulet, assembler"] },
  { id:"omelette-herbes", title:"Omelette champignons & fines herbes", subtitle:"Rapide du matin",
    kcal:420, timeMin:10, tags:["rapide","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
    ingredients:["œufs","champignons","ciboulette","beurre","sel","poivre","parmesan"], steps:["Battre, cuire, plier"] },
  { id:"saumon-four", title:"Saumon au four & légumes rôtis", subtitle:"Carottes, brocoli, citron",
    kcal:580, timeMin:25, tags:["omega-3","sans-gluten"], goals:["equilibre","santé"], minPlan:"BASIC",
    ingredients:["saumon","brocoli","carottes","citron","huile d'olive","ail","sel","poivre"], steps:["Préchauffer, rôtir, servir"] },
  { id:"curry-chiche", title:"Curry de pois chiches coco", subtitle:"Vegan & réconfortant",
    kcal:600, timeMin:30, tags:["vegan","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
    ingredients:["pois chiches","lait de coco","tomates concassées","oignon","ail","curry","riz basmati","sel"], steps:["Suer, mijoter, servir"] },
  { id:"tofu-brocoli-wok", title:"Tofu sauté au brocoli (wok)", subtitle:"Sauce soja-sésame",
    kcal:530, timeMin:15, tags:["vegan","rapide"], goals:["sèche","equilibre"], minPlan:"BASIC",
    ingredients:["tofu ferme","brocoli","sauce soja","ail","gingembre","graines de sésame","huile","maïzena"], steps:["Saisir, lier, napper"] },
];

/* ---- base Bar à prot' (typée Recipe pour réutiliser Card) ---- */
const SHAKES_BASE: Recipe[] = [
  { id:"shake-choco-banane", title:"Choco-banane protéiné", subtitle:"Lait, whey chocolat",
    kcal:360, timeMin:5, tags:["shake","rapide"], goals:["prise de masse","equilibre"], minPlan:"BASIC",
    ingredients:["banane","lait (ou végétal)","whey chocolat","beurre de cacahuète","glaçons"], steps:["Mixer 30–40 s","Servir bien frais"] },
  { id:"shake-vanille-cafe", title:"Vanille café frappé", subtitle:"Skyr, vanille",
    kcal:280, timeMin:5, tags:["shake","café"], goals:["sèche","equilibre"], minPlan:"BASIC",
    ingredients:["skyr","lait (ou végétal)","expresso froid","vanille","édulcorant (option)","glaçons"], steps:["Verser au blender","Mixer et déguster"] },
  { id:"shake-fruits-rouges", title:"Fruits rouges & yaourt grec", subtitle:"Frais & onctueux",
    kcal:320, timeMin:5, tags:["shake","fruité"], goals:["equilibre"], minPlan:"BASIC",
    ingredients:["yaourt grec 0%","lait (ou végétal)","fruits rouges surgelés","whey neutre","miel (option)"], steps:["Mixer fin","Goûter et ajuster"] },
  { id:"shake-tropical", title:"Tropical coco", subtitle:"Mangue, coco",
    kcal:340, timeMin:5, tags:["shake","fruité"], goals:["equilibre"], minPlan:"BASIC",
    ingredients:["lait de coco léger","mangue","ananas","whey neutre ou pois","citron vert"], steps:["Mixer 40 s","Servir avec glaçons"] },
];

/* ========= Mode IA pour PLUS/PREMIUM ========= */
async function generateAIRecipes({
  plan,
  kcal, kcalMin, kcalMax,
  allergens, dislikes,
  count = 12,
}: {
  plan: Plan;
  kcal?: number; kcalMin?: number; kcalMax?: number;
  allergens: string[]; dislikes: string[];
  count?: number;
}): Promise<Recipe[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];
  const constraints: string[] = [];
  if (typeof kcal === "number" && !isNaN(kcal) && kcal > 0) {
    constraints.push(`- Viser ~${kcal} kcal par recette (±10%).`);
  } else {
    const hasMin = typeof kcalMin === "number" && !isNaN(kcalMin) && kcalMin > 0;
    const hasMax = typeof kcalMax === "number" && !isNaN(kcalMax) && kcalMax > 0;
    if (hasMin && hasMax) constraints.push(`- Respecter une plage ${kcalMin}-${kcalMax} kcal.`);
    else if (hasMin) constraints.push(`- Minimum ${kcalMin} kcal.`);
    else if (hasMax) constraints.push(`- Maximum ${kcalMax} kcal.`);
  }
  if (allergens.length) constraints.push(`- Exclure strictement: ${allergens.join(", ")}.`);
  if (dislikes.length) constraints.push(`- Si un ingrédient non-aimé apparaît, ne pas le supprimer: proposer une section "rework" avec 2-3 façons de le cuisiner autrement.`);

  const prompt =
`Tu es un chef-nutritionniste. Renvoie UNIQUEMENT du JSON valide (pas de texte).
Utilisateur:
- Plan: ${plan}
- Allergènes/Intolérances: ${allergens.join(", ") || "aucun"}
- Aliments non aimés (à re-travailler): ${dislikes.join(", ") || "aucun"}
- Nombre de recettes: ${count}

Contraintes:
${constraints.join("\n")}

Schéma TypeScript (exemple):
Recipe = {
  id: string, title: string, subtitle?: string,
  kcal?: number, timeMin?: number, tags: string[],
  goals: string[], minPlan: "BASIC" | "PLUS" | "PREMIUM",
  ingredients: string[], steps: string[],
  rework?: { ingredient: string, tips: string[] }[]
}

Règles:
- minPlan = "${plan}" pour toutes les recettes.
- Variété: végétarien/vegan/protéiné/rapide/sans-gluten...
- Ingrédients simples du quotidien.
- steps = 3–6 étapes courtes.
- Renvoyer {"recipes": Recipe[]}.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Tu parles français et tu réponds en JSON strict." },
          { role: "user", content: prompt },
        ],
      }),
      cache: "no-store",
    });

    if (!res.ok) return [];
    const data = await res.json();
    let payload: any = {};
    try { payload = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch {}
    const arr: any[] = Array.isArray(payload?.recipes) ? payload.recipes : [];
    const seen = new Set<string>();
    const clean: Recipe[] = arr.map((raw) => {
      const title = String(raw?.title ?? "").trim();
      const id = String(raw?.id || title || Math.random().toString(36).slice(2)).trim()
        .toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const ingr = Array.isArray(raw?.ingredients) ? raw.ingredients.map((x: any) => String(x)) : [];
      const steps = Array.isArray(raw?.steps) ? raw.steps.map((x: any) => String(x)) : [];
      const rework: Rework[] | undefined = Array.isArray(raw?.rework)
        ? raw.rework.map((x: any) => ({
            ingredient: String(x?.ingredient || "").toLowerCase(),
            tips: Array.isArray(x?.tips) ? x.tips.map((t: any) => String(t)) : []
          }))
        : undefined;
      const minPlan: Plan = (plan === "PREMIUM" ? "PREMIUM" : "PLUS");

      return {
        id, title,
        subtitle: raw?.subtitle ? String(raw.subtitle) : undefined,
        kcal: typeof raw?.kcal === "number" ? raw.kcal : undefined,
        timeMin: typeof raw?.timeMin === "number" ? raw.timeMin : undefined,
        tags: Array.isArray(raw?.tags) ? raw.tags.map((t: any) => String(t)) : [],
        goals: Array.isArray(raw?.goals) ? raw.goals.map((g: any) => String(g)) : [],
        minPlan,
        ingredients: ingr,
        steps,
        rework,
      } as Recipe;
    }).filter((r) => {
      if (!r.title) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      const ingLow = r.ingredients.map(i => i.toLowerCase());
      if (allergens.some(a => ingLow.includes(a))) return false;
      return true;
    });

    return clean;
  } catch {
    return [];
  }
}

/* ---- fallback si IA indisponible ---- */
function personalizeFallback({
  base, kcal, kcalMin, kcalMax, allergens, dislikes, plan,
}: {
  base: Recipe[];
  kcal?: number; kcalMin?: number; kcalMax?: number;
  allergens: string[]; dislikes: string[]; plan: Plan;
}): Recipe[] {
  let filtered = base.filter(r => {
    const ing = r.ingredients.map(i => i.toLowerCase());
    return !allergens.some(a => ing.includes(a));
  });
  if (typeof kcal === "number" && !isNaN(kcal) && kcal > 0) {
    const tol = Math.max(75, Math.round(kcal * 0.15));
    filtered = filtered.filter(r => typeof r.kcal === "number" && Math.abs((r.kcal || 0) - kcal) <= tol);
  } else {
    const hasMin = typeof kcalMin === "number" && !isNaN(kcalMin) && kcalMin > 0;
    const hasMax = typeof kcalMax === "number" && !isNaN(kcalMax) && kcalMax > 0;
    if (hasMin) filtered = filtered.filter(r => (r.kcal || 0) >= (kcalMin as number));
    if (hasMax) filtered = filtered.filter(r => (r.kcal || 0) <= (kcalMax as number));
  }
  const dislikesSet = new Set(dislikes);
  const out: Recipe[] = filtered.map<Recipe>(r => {
    const ingLower = r.ingredients.map(i => i.toLowerCase());
    const hits = [...dislikesSet].filter(d => ingLower.includes(d));
    const minPlan: Plan = (plan === "PREMIUM" ? "PREMIUM" : "PLUS");
    if (!hits.length) return { ...r, minPlan };
    const tips: Rework[] = hits.map(h => ({ ingredient: h, tips: REWORK_TIPS[h] ?? ["Changer la cuisson", "Assaisonnement différent", "Mixer/hacher pour texture"] }));
    return { ...r, minPlan, rework: tips };
  });
  return out;
}

/* ===================== Filtres (Server Action) ===================== */
async function applyFiltersAction(formData: FormData): Promise<void> {
  "use server";
  const params = new URLSearchParams();
  const fields = ["kcal","kcalMin","kcalMax","allergens","dislikes"] as const;
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
    return Array.isArray(arr) ? arr.filter(x => x && typeof x.id === "string" && typeof x.title === "string") : [];
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
  if (!cur.some(x => x.id === id)) {
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

  const cur = readSaved().filter(x => x.id !== id);
  writeSaved(cur);
  redirect(returnTo);
}

/* ===================== Page ===================== */
export default async function Page({
  searchParams,
}: {
  searchParams?: { kcal?: string; kcalMin?: string; kcalMax?: string; allergens?: string; dislikes?: string; rnd?: string; view?: string };
}) {
  // Lecture session — aucune redirection selon le plan
  let plan: Plan = "BASIC";
  try {
    const mod = await import("@/lib/session");
    const s: any = await mod.getSession().catch(() => ({}));
    plan = (s?.plan as Plan) || "BASIC";
  } catch {}

  const kcal = Number(searchParams?.kcal ?? "");
  const kcalMin = Number(searchParams?.kcalMin ?? "");
  const kcalMax = Number(searchParams?.kcalMax ?? "");
  const allergens = parseCsv(searchParams?.allergens);
  const dislikes = parseCsv(searchParams?.dislikes);

  const hasKcalTarget = !isNaN(kcal) && kcal > 0;
  const hasKcalMin = !isNaN(kcalMin) && kcalMin > 0;
  const hasKcalMax = !isNaN(kcalMax) && kcalMax > 0;

  const view = (searchParams?.view === "shakes" ? "shakes" : "meals") as "meals" | "shakes";

  const healthy = HEALTHY_BASE;

  // bloc IA pour recettes — maintenant pour tout le monde (plus de condition sur BASIC/PLUS)
  let personalized: Recipe[] = [];
  let relaxedNote: string | null = null;

  {
    const ai = await generateAIRecipes({
      plan,
      kcal: hasKcalTarget ? kcal : undefined,
      kcalMin: hasKcalMin ? kcalMin : undefined,
      kcalMax: hasKcalMax ? kcalMax : undefined,
      allergens, dislikes,
      count: 16,
    });

    personalized = ai.length
      ? ai
      : personalizeFallback({
          base: HEALTHY_BASE,
          kcal: hasKcalTarget ? kcal : undefined,
          kcalMin: hasKcalMin ? kcalMin : undefined,
          kcalMax: hasKcalMax ? kcalMax : undefined,
          allergens, dislikes, plan,
        });

    if (personalized.length === 0) {
      const relaxed = personalizeFallback({ base: HEALTHY_BASE, allergens, dislikes, plan });
      if (relaxed.length) {
        personalized = relaxed;
        relaxedNote = "Ajustement automatique : contrainte calories relâchée (allergènes respectés).";
      } else {
        personalized = HEALTHY_BASE.map(r => ({ ...r, minPlan: plan }));
        relaxedNote = "Ajustement automatique : suggestions healthy compatibles avec vos contraintes.";
      }
    }
  }

  // cartes à afficher
  const seed = Number(searchParams?.rnd ?? "0") || 123456789;
  const healthyPick = pickRandomSeeded(healthy, 4, seed);
  const personalizedPick = pickRandomSeeded(personalized, 6, seed);

  // Bar à prot' : liste simple (même Card)
  const shakesPick = pickRandomSeeded(SHAKES_BASE, 6, seed + 7);

  // QS gardés
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
  const savedSet = new Set(saved.map(s => s.id));
  const currentUrl = `/dashboard/recipes?${qsParts.join("&")}`;

  // Liens nav bloc
  const linkMeals = `/dashboard/recipes?${baseQS}view=meals`;
  const linkShakes = `/dashboard/recipes?${baseQS}view=shakes`;

  return (
    <>
      {/* spacer pour laisser passer un topbar fixe éventuel */}
      <div className="h-10" aria-hidden="true" />

      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="page-header">
          <div>
            <h1 className="h1" style={{ marginBottom: 2, fontSize: "clamp(20px, 2.2vw, 24px)", lineHeight: 1.15 }}>
              Recettes
            </h1>
            <p className="lead" style={{ marginTop: 4, fontSize: "clamp(12px, 1.6vw, 14px)", lineHeight: 1.35, color: "#4b5563" }}>
              Healthy pour tous. L’IA adapte aux calories, allergies et aliments à re-travailler — pour tout le monde.
            </p>

            {/* Récap filtres actifs */}
            <div className="text-xs" style={{color:"#6b7280", marginTop:8}}>
              Filtres actifs — 
              {hasKcalTarget && <> cible: ~{kcal} kcal</>}
              {!hasKcalTarget && (hasKcalMin || hasKcalMax) && <> plage: {hasKcalMin? kcalMin:"…"}–{hasKcalMax? kcalMax:"…"} kcal</>}
              {allergens.length ? <> · allergènes: {allergens.join(", ")}</> : null}
              {dislikes.length ? <> · non aimés: {dislikes.join(", ")}</> : null}
              {(!hasKcalTarget && !hasKcalMin && !hasKcalMax && !allergens.length && !dislikes.length) && " aucun"}
            </div>
          </div>
          <div className="text-sm">
            Votre formule : <span className="badge" style={{ marginLeft: 6 }}>{plan}</span>
          </div>
        </div>

        {/* =================== Choix rapide (blocs cliquables) =================== */}
        <div className="grid gap-4 sm:grid-cols-2" style={{ marginTop: 12 }}>
          <a href={linkMeals} className="card" style={{ textDecoration:"none", color:"inherit", borderColor: view==="meals" ? "#111" : undefined }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                {/* CHANGEMENT: libellé "Recettes — Healthy" */}
                <strong>Recettes — Healthy</strong>
                <div className="text-sm" style={{ color:"#6b7280" }}>
                  Base healthy pour tous
                </div>
              </div>
              {view==="meals" && <span className="badge">Actif</span>}
            </div>
          </a>

          <a href={linkShakes} className="card" style={{ textDecoration:"none", color:"inherit", borderColor: view==="shakes" ? "#111" : undefined }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <strong>Bar à prot’ — Boissons protéinées</strong>
                <div className="text-sm" style={{ color:"#6b7280" }}>
                  Shakes/smoothies protéinés en 5 min
                </div>
              </div>
              {view==="shakes" && <span className="badge">Actif</span>}
            </div>
          </a>
        </div>

        {/* =================== Contraintes & filtres (les deux vues) =================== */}
        {(view==="meals" || view==="shakes") && (
          <div className="section" style={{ marginTop: 12 }}>
            <div className="section-head" style={{ marginBottom: 8, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <h2 style={{ margin:0, fontSize:"clamp(16px,1.9vw,18px)", lineHeight:1.2 }}>
                Contraintes & filtres
              </h2>
            </div>

            <form action={applyFiltersAction} className="grid gap-6 lg:grid-cols-2" >
              {/* plus de disabled ici : filtres dispo pour tous */}
              <fieldset style={{ display:"contents" }}>
                <div>
                  <label className="label">Cible calories (kcal)</label>
                  <input className="input" type="number" name="kcal" placeholder="ex: 600" defaultValue={!isNaN(kcal) && kcal>0 ? String(kcal) : ""} />
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="label">Min kcal</label>
                    <input className="input" type="number" name="kcalMin" placeholder="ex: 450" defaultValue={!isNaN(kcalMin) && kcalMin>0 ? String(kcalMin) : ""} />
                  </div>
                  <div>
                    <label className="label">Max kcal</label>
                    <input className="input" type="number" name="kcalMax" placeholder="ex: 700" defaultValue={!isNaN(kcalMax) && kcalMax>0 ? String(kcalMax) : ""} />
                  </div>
                </div>

                <div>
                  <label className="label">Allergènes / intolérances (séparés par virgules)</label>
                  <input className="input" type="text" name="allergens" placeholder="arachide, lactose, gluten" defaultValue={allergens.join(", ")} />
                </div>

                <div>
                  <label className="label">Aliments non aimés (re-travailler)</label>
                  <input className="input" type="text" name="dislikes" placeholder="brocoli, saumon, tofu..." defaultValue={dislikes.join(", ")} />
                  <div className="text-xs" style={{ color:"#6b7280", marginTop:4 }}>
                    On les garde, mais on propose une autre façon de les cuisiner.
                  </div>
                </div>
              </fieldset>

              <div className="flex items-center justify-between lg:col-span-2">
                <div className="text-sm" style={{ color: "#6b7280" }}>
                  Ajustez les filtres puis régénérez.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <a href="/dashboard/recipes" className="btn btn-outline" style={{ color: "#111" }}>
                    Réinitialiser
                  </a>
                  <button className="btn btn-dash" type="submit">Régénérer</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* =================== CONTENU selon view =================== */}
        {view==="meals" ? (
          <>
            {/* Vos recettes enregistrées */}
            {saved.length > 0 && (
              <section className="section" style={{ marginTop: 12 }}>
                <div className="section-head" style={{ marginBottom: 8 }}>
                  <h2>Vos recettes enregistrées</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                  {saved.map((s) => (
                    <article key={s.id} className="card" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                      <a href={`/dashboard/recipes/${s.id}`} className="font-semibold" style={{ textDecoration:"none", color:"var(--text,#111)" }}>
                        {s.title}
                      </a>
                      <form action={removeRecipeAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="returnTo" value={currentUrl || "/dashboard/recipes"} />
                        <button type="submit" className="btn btn-outline" style={{ color: "var(--text, #111)" }}>
                          Retirer
                        </button>
                      </form>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Healthy pour tous */}
            <section className="section" style={{ marginTop: 12 }}>
              <div className="section-head" style={{ marginBottom: 8 }}><h2>Healthy (pour tous)</h2></div>
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

            {/* Personnalisées IA — maintenant pour tout le monde */}
            <section className="section" style={{ marginTop: 12 }}>
              <div className="section-head" style={{ marginBottom: 8 }}>
                <h2>Recettes personnalisées (IA)</h2>
              </div>

              {relaxedNote && (
                <div className="text-xs" style={{ color:"#6b7280", marginBottom:8 }}>
                  {relaxedNote}
                </div>
              )}

              {personalizedPick.length ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                  {personalizedPick.map((r) => (
                    <Card
                      key={r.id}
                      r={r}
                      detailQS={encode(r)}
                      isSaved={savedSet.has(r.id)}
                      currentUrl={currentUrl || "/dashboard/recipes"}
                    />
                  ))}
                </div>
              ) : (
                <div className="card text-sm" style={{ color:"#6b7280" }}>
                  Aucune recette correspondant exactement à vos filtres pour le moment.
                  Essayez d’élargir la plage calorique ou de réduire les exclusions.
                </div>
              )}
            </section>
          </>
        ) : (
          /* ===== view: shakes ===== */
          <section className="section" style={{ marginTop: 12 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <h2>Bar à prot’ — Boissons protéinées</h2>
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
        )}
      </div>
    </>
  );
}

/* ===================== Carte Recette ===================== */
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
        <span className="badge">{r.minPlan}</span>
      </div>

      <div className="text-sm" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
        {typeof r.timeMin === "number" && <span className="badge">{r.timeMin} min</span>}
      </div>

      <div className="text-sm" style={{ marginTop: 10 }}>
        <strong>Ingrédients</strong>
        <ul style={{ margin: "6px 0 0 16px" }}>
          {shown.map((i, idx) => <li key={idx}>{i}</li>)}
          {more > 0 && <li>+ {more} autre(s)…</li>}
        </ul>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <a className="btn btn-dash" href={href}>Voir la recette</a>

        {isSaved ? (
          <form action={removeRecipeAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="returnTo" value={currentUrl} />
            <button type="submit" className="btn btn-outline" style={{ color: "var(--text, #111)" }}>
              Enregistrée ✓ (Retirer)
            </button>
          </form>
        ) : (
          <form action={saveRecipeAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="title" value={r.title} />
            <input type="hidden" name="returnTo" value={currentUrl} />
            <button type="submit" className="btn btn-outline" style={{ color: "var(--text, #111)" }}>
              Enregistrer
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
