// app/dashboard/recipes/page.tsx
import { PageHeader, Section } from "@/components/ui/Page";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

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

async function callOpenAIChatJSON(userPrompt: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return {};
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
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
  try { return JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { return {}; }
}

function sampleFallback(): Recipe[] {
  return [{
    id: "salade-quinoa",
    title: "Salade de quinoa croquante",
    subtitle: "Pois chiches, concombre, citron",
    kcal: 520, timeMin: 15,
    tags: ["végétarien","sans-gluten"],
    goals: ["equilibre"],
    minPlan: "BASIC",
    ingredients: ["quinoa","pois chiches","concombre","citron","huile d'olive","sel","poivre"],
    steps: ["Cuire le quinoa","Mélanger avec le reste","Assaisonner"],
  }];
}

async function generateRecipes({
  plan, goals = [], count = 8, kcalTarget, kcalMin, kcalMax, allergens = [], diets = [],
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
    : plan === "PLUS" ? "- Au moins 60% des recettes avec minPlan = PLUS (le reste BASIC). 1-2 recettes PREMIUM possibles (verrouillables)."
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
    "SCHEMA (TypeScript):",
    "Recipe = {",
    "  id: string,",
    "  title: string,",
    "  subtitle?: string,",
    "  kcal?: number,",
    "  timeMin?: number,",
    "  tags: string[],",
    "  goals: string[],",
    "  minPlan: 'BASIC'|'PLUS'|'PREMIUM',",
    "  ingredients: string[],",
    "  steps: string[]",
    "}",
    "",
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
      return Boolean(r.title) && r.ingredients.length >= 3 && r.steps.length >= 2;
    });

  return cleaned.length ? cleaned : sampleFallback();
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { f?: string; kcal?: string; kcalMin?: string; kcalMax?: string; allergens?: string; diets?: string; };
}) {
  const s = await getSession();
  const plan: Plan = (s?.plan as Plan) || "BASIC";
  const goals = normalizeGoals(s);
  const filter = searchParams?.f || "reco";

  const kcal = Number(searchParams?.kcal ?? "");
  const kcalMin = Number(searchParams?.kcalMin ?? "");
  const kcalMax = Number(searchParams?.kcalMax ?? "");
  const allergens = parseCsv(searchParams?.allergens);
  const diets = parseCsv(searchParams?.diets);

  const hasKcalTarget = !isNaN(kcal) && kcal > 0;
  const hasKcalMin = !isNaN(kcalMin) && kcalMin > 0;
  const hasKcalMax = !isNaN(kcalMax) && kcalMax > 0;

  const aiRecipes = await generateRecipes({
    plan, goals, count: 8,
    kcalTarget: hasKcalTarget ? kcal : undefined,
    kcalMin: hasKcalMin ? kcalMin : undefined,
    kcalMax: hasKcalMax ? kcalMax : undefined,
    allergens, diets,
  });

  const available = aiRecipes.filter((r) => isUnlocked(r, plan));
  const locked = aiRecipes.filter((r) => !isUnlocked(r, plan));

  const goalSet = new Set(goals);
  const score = (r: Recipe) => r.goals.reduce((n, g) => n + (goalSet.has(String(g).toLowerCase()) ? 1 : 0), 0);
  available.sort((a, b) => score(b) - score(a));

  // Construit la query string pour la page détail
  const qsParts: string[] = [];
  if (hasKcalTarget) qsParts.push(`kcal=${kcal}`);
  if (hasKcalMin) qsParts.push(`kcalMin=${kcalMin}`);
  if (hasKcalMax) qsParts.push(`kcalMax=${kcalMax}`);
  if (allergens.length) qsParts.push(`allergens=${encodeURIComponent(allergens.join(","))}`);
  if (diets.length) qsParts.push(`diets=${encodeURIComponent(diets.join(","))}`);
  const detailQS = qsParts.length ? `?${qsParts.join("&")}` : "";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <PageHeader
        title="Recettes personnalisées"
        subtitle="Générées par IA selon votre formule, objectifs et contraintes"
      />

      {/* Panneau de contraintes */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Contraintes & filtres</h2>
          <div className="text-sm" style={{ color: "#6b7280" }}>Ajustez et régénérez les suggestions</div>
        </div>

        <form method="GET" className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="label">Cible calories (kcal)</label>
            <input className="input" type="number" name="kcal" placeholder="ex: 600" defaultValue={hasKcalTarget ? String(kcal) : ""} />
            <div className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>Ou précisez une plage ci-dessous.</div>
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
            <input className="input" type="text" name="allergens" placeholder="arachide, lactose, gluten" defaultValue={(searchParams?.allergens ?? "") as string} />
          </div>

          <div>
            <label className="label">Régimes / préférences (séparés par virgules)</label>
            <input className="input" type="text" name="diets" placeholder="vegan, sans-gluten, halal" defaultValue={(searchParams?.diets ?? "") as string} />
          </div>

          <div className="flex items-center justify-between lg:col-span-2">
            <div>
              <span className="text-sm" style={{ color: "#6b7280" }}>Votre formule : </span>
              <span className="badge" style={{ marginLeft: 6 }}>{plan}</span>
              {goals.length > 0 && (
                <span className="text-sm" style={{ marginLeft: 10 }}>
                  Objectifs: {goals.map((g) => <span key={g} className="badge" style={{ marginRight: 6 }}>{g}</span>)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <a href="/dashboard/recipes" className="btn btn-outline">Réinitialiser</a>
              <button className="btn btn-dash" type="submit">Régénérer</button>
            </div>
          </div>
        </form>
      </div>

      {/* Résultats IA */}
      <Section title={filter === "reco" ? "Recommandé pour vous (IA)" : "Toutes vos recettes (IA)"}>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {(filter === "reco" ? available : available).map((r) => (
            <RecipeCard key={r.id} r={r} detailQS={detailQS} />
          ))}
        </div>
      </Section>

      {locked.length > 0 && (
        <Section title="Verrouillées (IA)">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {locked.map((r) => (
              <LockedCard key={r.id} r={r} userPlan={plan} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function RecipeCard({ r, detailQS }: { r: Recipe; detailQS: string }) {
  return (
    <article className="card" style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
        <span className="badge">{r.minPlan}</span>
      </div>
      {r.subtitle && <div className="text-sm" style={{ color: "#6b7280", marginTop: 4 }}>{r.subtitle}</div>}
      <div className="text-sm" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
        {typeof r.timeMin === "number" && <span className="badge">{r.timeMin} min</span>}
        {r.tags.map((t) => <span key={t} className="badge">{t}</span>)}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary className="btn btn-outline">Détails</summary>
        <div className="text-sm" style={{ marginTop: 10 }}>
          <strong>Ingrédients</strong>
          <ul style={{ margin: "6px 0 0 16px" }}>{r.ingredients.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
          <strong style={{ display: "block", marginTop: 10 }}>Étapes</strong>
          <ol style={{ margin: "6px 0 0 16px" }}>{r.steps.map((s, idx) => <li key={idx}>{s}</li>)}</ol>
        </div>
      </details>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <a className="btn btn-dash" href={`/dashboard/recipes/${r.id}${detailQS}`}>Voir la recette</a>
        <button className="btn btn-outline" type="button">Ajouter à mon plan</button>
      </div>
    </article>
  );
}

function LockedCard({ r, userPlan }: { r: Recipe; userPlan: Plan }) {
  const targetPlan = r.minPlan;
  const needUpgrade =
    targetPlan === "PLUS" && userPlan === "BASIC" ? "PLUS"
    : targetPlan === "PREMIUM" && userPlan !== "PREMIUM" ? "PREMIUM"
    : targetPlan;

  return (
    <article className="card" style={{ position: "relative", overflow: "hidden", opacity: 0.9 }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent, rgba(0,0,0,.04))" }} />
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
        <span className="badge">{r.minPlan}</span>
      </div>
      {r.subtitle && <div className="text-sm" style={{ color: "#6b7280", marginTop: 4 }}>{r.subtitle}</div>}
      <div className="text-sm" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
        {typeof r.timeMin === "number" && <span className="badge">{r.timeMin} min</span>}
        {r.tags.map((t) => <span key={t} className="badge">{t}</span>)}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn btn-outline" disabled>Verrouillé</button>
        <a className="btn btn-dash" href={"/dashboard/abonnement"}>Passer à {needUpgrade}</a>
      </div>
    </article>
  );
}
