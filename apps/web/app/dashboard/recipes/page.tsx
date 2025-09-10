// apps/web/app/dashboard/recipes/page.tsx
import { PageHeader, Section } from "@/components/ui/Page";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function planRank(p?: Plan) { return p === "PREMIUM" ? 3 : p === "PLUS" ? 2 : 1; }
function isUnlocked(r: Recipe, userPlan: Plan) { return planRank(userPlan) >= planRank(r.minPlan); }
function normalizeGoals(s: any): string[] {
  const raw = s?.goals ?? s?.objectifs ?? s?.goal ?? s?.objectif ?? [];
  const arr = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,|]/);
  return arr.map((x) => x.toString().trim().toLowerCase()).filter(Boolean);
}
function parseCsv(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw.split(/[,|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function uid() { return "id-" + Math.random().toString(36).slice(2, 10); }

function seededPRNG(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = seededPRNG(seed); const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickRandomSeeded<T>(arr: T[], n: number, seed: number) {
  return seededShuffle(arr, seed).slice(0, Math.max(0, Math.min(n, arr.length)));
}

// ---- Appel OpenAI robuste via fetch ----
async function callOpenAIChatJSON(userPrompt: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return {};
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Tu es un chef-nutritionniste francophone. Tu renvoies UNIQUEMENT du JSON valide, sans texte hors JSON." },
          { role: "user", content: userPrompt },
        ],
      }),
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = await res.json();
    return JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
  } catch { return {}; }
}

function sampleFallback(count = 12): Recipe[] {
  const samples: Recipe[] = [
    { id:"salade-quinoa", title:"Salade de quinoa croquante", subtitle:"Pois chiches, concombre, citron",
      kcal:520, timeMin:15, tags:["végétarien","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
      ingredients:["quinoa","pois chiches","concombre","citron","huile d'olive","sel","poivre","persil"], steps:["A","B","C"] },
    { id:"bowl-poulet-riz", title:"Bowl poulet & riz complet", subtitle:"Avocat, maïs, yaourt grec",
      kcal:640, timeMin:20, tags:["riche-protéines"], goals:["prise de masse","equilibre"], minPlan:"BASIC",
      ingredients:["poulet","riz complet","avocat","maïs","yaourt grec","cumin","citron","sel","poivre"], steps:["A","B","C"] },
    { id:"omelette-champignons", title:"Omelette aux champignons & fines herbes", subtitle:"Rapide du matin",
      kcal:420, timeMin:10, tags:["rapide","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
      ingredients:["œufs","champignons","ciboulette","beurre","sel","poivre","parmesan"], steps:["A","B","C"] },
    { id:"saumon-four", title:"Saumon au four & légumes rôtis", subtitle:"Carottes, brocoli, citron",
      kcal:580, timeMin:25, tags:["omega-3","sans-gluten"], goals:["equilibre","santé"], minPlan:"PLUS",
      ingredients:["saumon","brocoli","carottes","citron","huile d'olive","ail","sel","poivre"], steps:["A","B","C"] },
    { id:"curry-pois-chiches", title:"Curry de pois chiches coco", subtitle:"Vegan & réconfortant",
      kcal:600, timeMin:30, tags:["vegan","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
      ingredients:["pois chiches","lait de coco","tomates concassées","oignon","ail","curry","riz basmati","sel"], steps:["A","B","C"] },
    { id:"pates-completes-legumes", title:"Pâtes complètes aux légumes grillés", subtitle:"Courgette, poivron, feta",
      kcal:680, timeMin:20, tags:["végétarien"], goals:["énergie","equilibre"], minPlan:"BASIC",
      ingredients:["pâtes complètes","courgette","poivron","feta","huile d'olive","basilic","sel","poivre"], steps:["A","B","C"] },
    { id:"tofu-brocoli-wok", title:"Tofu sauté au brocoli (wok)", subtitle:"Sauce soja sésame",
      kcal:530, timeMin:15, tags:["vegan","rapide"], goals:["sèche","equilibre"], minPlan:"BASIC",
      ingredients:["tofu ferme","brocoli","sauce soja","ail","gingembre","graines de sésame","huile","maïzena"], steps:["A","B","C"] },
    { id:"smoothie-bowl", title:"Smoothie bowl fruits rouges", subtitle:"Granola & chia",
      kcal:450, timeMin:8, tags:["végétarien","petit-déj"], goals:["santé"], minPlan:"BASIC",
      ingredients:["fruits rouges","banane","yaourt","lait","granola","graines de chia","miel"], steps:["A","B","C"] },
    { id:"chili-sin-carne", title:"Chili sin carne", subtitle:"Haricots rouges, maïs, paprika fumé",
      kcal:610, timeMin:35, tags:["vegan"], goals:["equilibre"], minPlan:"BASIC",
      ingredients:["haricots rouges","maïs","tomates concassées","oignon","ail","paprika fumé","cumin","riz"], steps:["A","B","C"] },
    { id:"wrap-thon-avocat", title:"Wrap thon & avocat", subtitle:"Citron & yaourt",
      kcal:520, timeMin:10, tags:["rapide"], goals:["equilibre"], minPlan:"BASIC",
      ingredients:["tortillas","thon","avocat","yaourt","citron","salade","sel","poivre"], steps:["A","B","C"] },
    { id:"soupe-lentilles", title:"Soupe de lentilles corail", subtitle:"Carotte & cumin",
      kcal:480, timeMin:25, tags:["végétarien","réchauffant"], goals:["santé"], minPlan:"BASIC",
      ingredients:["lentilles corail","carotte","oignon","ail","bouillon","cumin","huile d'olive","citron"], steps:["A","B","C"] },
    { id:"shakshuka", title:"Shakshuka", subtitle:"Œufs pochés à la tomate",
      kcal:560, timeMin:20, tags:["végétarien","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
      ingredients:["œufs","tomates concassées","poivron","oignon","ail","paprika","cumin","persil"], steps:["A","B","C"] },
  ];
  const seed = Date.now();
  return seededShuffle(samples, seed).slice(0, Math.min(count, samples.length));
}

async function generateRecipes({
  plan, goals = [], count = 16, kcalTarget, kcalMin, kcalMax, allergens = [], diets = [],
}: {
  plan: Plan; goals?: string[]; count?: number;
  kcalTarget?: number; kcalMin?: number; kcalMax?: number;
  allergens?: string[]; diets?: string[];
}): Promise<Recipe[]> {
  const constraints: string[] = [];
  if (typeof kcalTarget === "number" && !isNaN(kcalTarget)) constraints.push(`- Viser ~${kcalTarget} kcal par recette (±10%).`);
  else {
    const hasMin = typeof kcalMin === "number" && !isNaN(kcalMin);
    const hasMax = typeof kcalMax === "number" && !isNaN(kcalMax);
    if (hasMin && hasMax) constraints.push(`- Respecter une plage calorique ${kcalMin}-${kcalMax} kcal.`);
    else if (hasMin) constraints.push(`- Au moins ${kcalMin} kcal par recette.`);
    else if (hasMax) constraints.push(`- Au plus ${kcalMax} kcal par recette.`);
  }
  if (allergens.length) constraints.push(`- Exclure strictement ingrédients/allergènes: ${allergens.join(", ")}.`);
  if (diets.length) constraints.push(`- Respecter les régimes: ${diets.join(", ")}.`);

  const planRule =
    plan === "BASIC" ? "- Au moins 70% des recettes avec minPlan = BASIC."
    : plan === "PLUS" ? "- Au moins 60% des recettes avec minPlan = PLUS (le reste BASIC). 1-2 recettes PREMIUM possibles."
    : "- Inclure quelques recettes PREMIUM.";

  const user = [
    `PLAN_UTILISATEUR: ${plan}`,
    `OBJECTIFS: ${goals.join(", ") || "equilibre"}`,
    `NOMBRE_RECETTES: ${count}`,
    "",
    "CONTRAINTES:",
    planRule,
    "- Varier types (végétarien, riche-protéines, sans-gluten, rapide...).",
    "- Fournir kcal, timeMin, tags pertinents.",
    constraints.length ? constraints.join("\n") : "",
    '- Renvoyer un objet JSON {"recipes": Recipe[]} conforme au schéma.',
    "",
    "SCHEMA (TypeScript): Recipe = { id: string, title: string, subtitle?: string, kcal?: number, timeMin?: number, tags: string[], goals: string[], minPlan: 'BASIC'|'PLUS'|'PREMIUM', ingredients: string[], steps: string[] }",
    "Exige JSON STRICT, sans explication.",
  ].filter(Boolean).join("\n");

  const payload = await callOpenAIChatJSON(user);
  const arr: Recipe[] = Array.isArray(payload?.recipes) ? payload.recipes : [];
  const seen = new Set<string>();
  const cleaned = arr
    .map((r) => ({
      ...r,
      id: String(r.id || r.title || uid()).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      title: String(r.title || "").trim(),
      subtitle: r.subtitle ? String(r.subtitle).trim() : undefined,
      tags: Array.isArray(r.tags) ? r.tags.map((t: any) => String(t).trim()) : [],
      goals: Array.isArray(r.goals) ? r.goals.map((g: any) => String(g).trim()) : [],
      minPlan: (["BASIC","PLUS","PREMIUM"].includes(r.minPlan) ? r.minPlan : "BASIC") as Plan,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => String(i)) : [],
      steps: Array.isArray(r.steps) ? r.steps.map((s: any) => String(s)) : [],
    }))
    .filter((r) => {
      if (!r.id || seen.has(r.id)) return false;
      seen.add(r.id);
      // 3 ingrédients & 3 étapes minimum
      return Boolean(r.title) && r.ingredients.length >= 3 && r.steps.length >= 3;
    });

  return cleaned.length ? cleaned : sampleFallback(count);
}

/** ---- Server Action: applique filtres; si BASIC => abonnement ---- */
async function applyFiltersAction(formData: FormData): Promise<void> {
  "use server";
  const s = await getSession();
  const plan: Plan = (s?.plan as Plan) || "BASIC";

  const params = new URLSearchParams();
  const fields = ["kcal","kcalMin","kcalMax","allergens","diets"] as const;
  for (const f of fields) {
    const val = (formData.get(f) ?? "").toString().trim();
    if (val) params.set(f, val);
  }

  if (plan === "BASIC") {
    redirect("/dashboard/abonnement");
  }

  const qs = params.toString();
  redirect(`/dashboard/recipes${qs ? `?${qs}` : ""}`);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { f?: string; kcal?: string; kcalMin?: string; kcalMax?: string; allergens?: string; diets?: string; rnd?: string };
}) {
  const s = await getSession();
  const plan: Plan = (s?.plan as Plan) || "BASIC";
  const goals = normalizeGoals(s);

  const kcal = Number(searchParams?.kcal ?? "");
  const kcalMin = Number(searchParams?.kcalMin ?? "");
  const kcalMax = Number(searchParams?.kcalMax ?? "");
  const allergens = parseCsv(searchParams?.allergens);
  const diets = parseCsv(searchParams?.diets);

  const hasKcalTarget = !isNaN(kcal) && kcal > 0;
  const hasKcalMin = !isNaN(kcalMin) && kcalMin > 0;
  const hasKcalMax = !isNaN(kcalMax) && kcalMax > 0;

  const aiRecipes = await generateRecipes({
    plan, goals, count: 16,
    kcalTarget: hasKcalTarget ? kcal : undefined,
    kcalMin: hasKcalMin ? kcalMin : undefined,
    kcalMax: hasKcalMax ? kcalMax : undefined,
    allergens, diets,
  });

  // Défense en profondeur : recettes valides uniquement
  const available = aiRecipes.filter(
    (r) => isUnlocked(r, plan) && r.title && r.ingredients?.length >= 3 && r.steps?.length >= 3
  );

  const seed = Number(searchParams?.rnd) || Date.now();
  const recommended = pickRandomSeeded(available, 6, seed);

  const qsParts: string[] = [];
  if (hasKcalTarget) qsParts.push(`kcal=${kcal}`);
  if (hasKcalMin) qsParts.push(`kcalMin=${kcalMin}`);
  if (hasKcalMax) qsParts.push(`kcalMax=${kcalMax}`);
  if (allergens.length) qsParts.push(`allergens=${encodeURIComponent(allergens.join(","))}`);
  if (diets.length) qsParts.push(`diets=${encodeURIComponent(diets.join(","))}`);
  const baseQS = qsParts.length ? `?${qsParts.join("&")}` : "";

  const encode = (r: Recipe) => {
    const raw = JSON.stringify(r);
    const b64 = Buffer.from(raw, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    // Encodage URL pour éviter les exceptions client
    const safe = encodeURIComponent(b64);
    return `${baseQS}${baseQS ? "&" : "?"}data=${safe}`;
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <PageHeader title="Recettes personnalisées" subtitle="Générées par IA selon votre formule, objectifs et contraintes" />

      {plan === "BASIC" && (
        <div className="card" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <strong>Débloquez les recettes détaillées</strong>
            <div className="text-sm" style={{ color: "#6b7280" }}>Passez à PLUS ou PREMIUM pour accéder aux étapes et plans repas.</div>
          </div>
          <a className="btn btn-dash" href="/dashboard/abonnement">Gérer mon abonnement</a>
        </div>
      )}

      <div className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Contraintes & filtres</h2>
        </div>

        <form action={applyFiltersAction} className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="label">Cible calories (kcal)</label>
            <input className="input" type="number" name="kcal" placeholder="ex: 600" defaultValue={hasKcalTarget ? String(kcal) : ""} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="label">Min kcal</label>
              <input className="input" type="number" name="kcalMin" placeholder="ex: 450" defaultValue={hasKcalMin ? String(kcalMin) : ""} />
            </div>
            <div>
              <label className="label">Max kcal</label>
              <input className="input" type="number" name="kcalMax" placeholder="ex: 700" defaultValue={hasKcalMax ? String(kcalMax) : ""} />
            </div>
          </div>

          <div>
            <label className="label">Allergènes à exclure (séparés par virgules)</label>
            <input className="input" type="text" name="allergens" placeholder="arachide, lactose, gluten" defaultValue={allergens.join(", ")} />
          </div>

          <div>
            <label className="label">Régimes / préférences (séparés par virgules)</label>
            <input className="input" type="text" name="diets" placeholder="vegan, sans-gluten, halal" defaultValue={diets.join(", ")} />
          </div>

          <div className="flex items-center justify-between lg:col-span-2">
            <div className="text-sm" style={{ color: "#6b7280" }}>
              Votre formule : <span className="badge" style={{ marginLeft: 6 }}>{plan}</span>
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

      <Section title="Recommandé pour vous (IA)">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {recommended.map((r) => {
            const detailQS = encode(r);
            return <RecommendedCard key={r.id} r={r} detailQS={detailQS} />;
          })}
          {recommended.length === 0 && (
            <div className="text-sm" style={{ color: "#6b7280" }}>
              Aucune recette disponible pour ces filtres. Essayez d’assouplir les contraintes.
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function RecommendedCard({ r, detailQS }: { r: Recipe; detailQS: string; }) {
  // Toujours ouvrir la page détail ; paywall géré côté détail
  const href = `/dashboard/recipes/${r.id}${detailQS}`;
  const shown = r.ingredients.slice(0, 8);
  const more = Math.max(0, r.ingredients.length - shown.length);

  return (
    <article className="card" style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
        <span className="badge">{r.minPlan}</span>
      </div>
      <div className="text-sm" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
      </div>
      <div className="text-sm" style={{ marginTop: 10 }}>
        <strong>Ingrédients</strong>
        <ul style={{ margin: "6px 0 0 16px" }}>
          {shown.map((i, idx) => <li key={idx}>{i}</li>)}
          {more > 0 && <li>+ {more} autre(s)…</li>}
        </ul>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Link
          className="btn btn-dash"
          href={href}
          prefetch={false}
          style={{ pointerEvents: "auto" }}
          {...(process.env.NODE_ENV !== "production" ? { onClick: () => console.log("Go to:", href) } : {})}
        >
          Voir la recette
        </Link>
      </div>
    </article>
  );
}
