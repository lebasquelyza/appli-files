// =============================================
// lib/ai.ts
// =============================================
import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// =============================================
// lib/recipes-ai.ts
// =============================================
import { openai } from "./ai";
import { z } from "zod";

export const PlanSchema = z.enum(["BASIC", "PLUS", "PREMIUM"]);
export type Plan = z.infer<typeof PlanSchema>;

export const RecipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  kcal: z.number().int().positive().optional(),
  timeMin: z.number().int().positive().optional(),
  tags: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  minPlan: PlanSchema, // BASIC | PLUS | PREMIUM
  ingredients: z.array(z.string()).min(3),
  steps: z.array(z.string()).min(2),
});

export type Recipe = z.infer<typeof RecipeSchema>;

const RecipesEnvelope = z.object({ recipes: z.array(RecipeSchema).min(4).max(24) });

function planRank(p?: Plan) {
  return p === "PREMIUM" ? 3 : p === "PLUS" ? 2 : 1;
}

export function normalizeGoals(s: any): string[] {
  const raw = s?.goals ?? s?.objectifs ?? s?.goal ?? s?.objectif ?? [];
  const arr = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,|]/);
  return arr.map((x) => x.toString().trim().toLowerCase()).filter(Boolean);
}

export function isUnlocked(r: Recipe, userPlan: Plan): boolean {
  return planRank(userPlan) >= planRank(r.minPlan);
}

/** Parse une liste séparée par virgules en tableau normalisé */
export function parseCsv(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw
    .split(/[,|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Génère des recettes (personnalisées) avec l'IA, en JSON strict
export async function generateRecipes({
  plan,
  goals = [],
  count = 8,
  kcalTarget,
  kcalMin,
  kcalMax,
  allergens = [],
  diets = [],
}: {
  plan: Plan;
  goals?: string[];
  count?: number;
  kcalTarget?: number;
  kcalMin?: number;
  kcalMax?: number;
  allergens?: string[]; // ex: ['arachide','lactose']
  diets?: string[]; // ex: ['vegan','sans-gluten']
}): Promise<Recipe[]> {
  const sys = `Tu es un chef-nutritionniste francophone. Tu proposes des recettes équilibrées, précises, et adaptées au niveau d'abonnement d'un utilisateur (BASIC/PLUS/PREMIUM). Tu dois renvoyer UNIQUEMENT du JSON valide, sans texte hors JSON.`;

  const constraints: string[] = [];
  if (typeof kcalTarget === 'number' && !isNaN(kcalTarget)) {
    constraints.push(`- Viser ~${kcalTarget} kcal par recette (±10%).`);
  } else {
    const hasMin = typeof kcalMin === 'number' && !isNaN(kcalMin);
    const hasMax = typeof kcalMax === 'number' && !isNaN(kcalMax);
    if (hasMin && hasMax) constraints.push(`- Respecter une plage calorique ${kcalMin}-${kcalMax} kcal.`);
    else if (hasMin) constraints.push(`- Au moins ${kcalMin} kcal par recette.`);
    else if (hasMax) constraints.push(`- Au plus ${kcalMax} kcal par recette.`);
  }
  if (allergens.length) constraints.push(`- Exclure strictement ingrédients/allergènes: ${allergens.join(", ")}.`);
  if (diets.length) constraints.push(`- Respecter les régimes: ${diets.join(", ")}.`);

  const planRule =
    plan === 'BASIC'
      ? "- Au moins 70% des recettes avec minPlan = BASIC."
      : plan === 'PLUS'
      ? "- Au moins 60% des recettes avec minPlan = PLUS (le reste BASIC). 1-2 recettes PREMIUM possibles (verrouillables)."
      : "- Inclure quelques recettes PREMIUM.";

  const user = `PLAN_UTILISATEUR: ${plan}
OBJECTIFS: ${goals.join(", ") || "equilibre"}
NOMBRE_RECETTES: ${count}

CONTRAINTES:
${planRule}
- Varier types (végétarien, riche-protéines, sans-gluten, rapide...).
- Fournir kcal, timeMin, tags pertinents.
${constraints.join("
")}
- Renvoyer un objet JSON {\"recipes\": Recipe[]} conforme au schéma.

SCHEMA (TypeScript):
Recipe = {
  id: string,                 // slug simple ex: \"saumon-teriyaki\"
  title: string,
  subtitle?: string,
  kcal?: number,
  timeMin?: number,
  tags: string[],
  goals: string[],            // ex: ['perte-poids', 'prise-masse']
  minPlan: 'BASIC'|'PLUS'|'PREMIUM',
  ingredients: string[],
  steps: string[]
}

Exige JSON STRICT, sans explication.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices[0]?.message?.content || "{}";
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { recipes: [] };
  }

  const parsed = RecipesEnvelope.safeParse(data);
  if (!parsed.success) {
    return [
      {
        id: "salade-quinoa",
        title: "Salade de quinoa croquante",
        subtitle: "Pois chiches, concombre, citron",
        kcal: 520,
        timeMin: 15,
        tags: ["végétarien", "sans-gluten"],
        goals: ["equilibre"],
        minPlan: "BASIC",
        ingredients: ["quinoa", "pois chiches", "concombre", "citron", "huile d'olive", "sel", "poivre"],
        steps: ["Cuire le quinoa", "Mélanger avec le reste", "Assaisonner"],
      },
    ];
  }

  const seen = new Set<string>();
  const cleaned = parsed.data.recipes
    .filter((r) => (r.id = r.id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")))
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .map((r) => ({
      ...r,
      title: r.title.trim(),
      subtitle: r.subtitle?.trim(),
      tags: r.tags.map((t) => t.trim()),
      goals: r.goals.map((g) => g.trim()),
    }));

  return cleaned;
}

// =============================================
// app/dashboard/recette/page.tsx
// =============================================
import { getSession } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";
import { generateRecipes, isUnlocked, normalizeGoals, parseCsv, type Plan, type Recipe } from "@/lib/recipes-ai";

export default async function Page({ searchParams }: { searchParams?: { f?: string; kcal?: string; kcalMin?: string; kcalMax?: string; allergens?: string; diets?: string } }) {
  const s = await getSession();
  const plan: Plan = (s?.plan as Plan) || "BASIC";
  const goals = normalizeGoals(s);

  const filter = searchParams?.f || "reco"; // 'reco' | 'tout'

  // Parse contraintes depuis l'URL
  const kcal = Number(searchParams?.kcal ?? "");
  const kcalMin = Number(searchParams?.kcalMin ?? "");
  const kcalMax = Number(searchParams?.kcalMax ?? "");
  const allergens = parseCsv(searchParams?.allergens);
  const diets = parseCsv(searchParams?.diets);

  const hasKcalTarget = !isNaN(kcal) && kcal > 0;
  const hasKcalMin = !isNaN(kcalMin) && kcalMin > 0;
  const hasKcalMax = !isNaN(kcalMax) && kcalMax > 0;

  // Génération IA côté serveur
  const aiRecipes = await generateRecipes({
    plan,
    goals,
    count: 8,
    kcalTarget: hasKcalTarget ? kcal : undefined,
    kcalMin: hasKcalMin ? kcalMin : undefined,
    kcalMax: hasKcalMax ? kcalMax : undefined,
    allergens,
    diets,
  });

  const available = aiRecipes.filter((r) => isUnlocked(r, plan));
  const locked = aiRecipes.filter((r) => !isUnlocked(r, plan));

  const goalSet = new Set(goals);
  const score = (r: Recipe) => r.goals.reduce((n, g) => n + (goalSet.has(g.toLowerCase()) ? 1 : 0), 0);
  available.sort((a, b) => score(b) - score(a));

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <PageHeader
        title="Recettes personnalisées"
        subtitle="Générées par IA selon votre formule, objectifs et contraintes"
      />

      {/* Panneau de contraintes IA */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Contraintes & filtres</h2>
          <div className="text-sm" style={{ color: '#6b7280' }}>Ajustez et régénérez les suggestions</div>
        </div>

        {/* Formulaire GET pour rester sans JS client */}
        <form method="GET" className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="label">Cible calories (kcal)</label>
            <input className="input" type="number" name="kcal" placeholder="ex: 600" defaultValue={hasKcalTarget ? String(kcal) : ''} />
            <div className="text-sm" style={{ color: '#6b7280', marginTop: 6 }}>Ou précisez une plage ci-dessous.</div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="label">Min kcal</label>
              <input className="input" type="number" name="kcalMin" placeholder="ex: 450" defaultValue={hasKcalMin ? String(kcalMin) : ''} />
            </div>
            <div>
              <label className="label">Max kcal</label>
              <input className="input" type="number" name="kcalMax" placeholder="ex: 700" defaultValue={hasKcalMax ? String(kcalMax) : ''} />
            </div>
          </div>

          <div>
            <label className="label">Allergènes à exclure (séparés par virgules)</label>
            <input className="input" type="text" name="allergens" placeholder="arachide, lactose, gluten" defaultValue={(searchParams?.allergens ?? '') as string} />
          </div>

          <div>
            <label className="label">Régimes / préférences (séparés par virgules)</label>
            <input className="input" type="text" name="diets" placeholder="vegan, sans-gluten, halal" defaultValue={(searchParams?.diets ?? '') as string} />
          </div>

          <div className="flex items-center justify-between lg:col-span-2">
            <div>
              <span className="text-sm" style={{ color: '#6b7280' }}>Votre formule : </span>
              <span className="badge" style={{ marginLeft: 6 }}>{plan}</span>
              {goals.length > 0 && (
                <span className="text-sm" style={{ marginLeft: 10 }}>
                  Objectifs : {goals.map((g) => <span key={g} className="badge" style={{ marginRight: 6 }}>{g}</span>)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/dashboard/recette" className="btn btn-outline">Réinitialiser</a>
              <button className="btn btn-dash" type="submit">Régénérer</button>
            </div>
          </div>
        </form>
      </div>

      {/* Résultats IA */}
      <Section title={filter === 'reco' ? 'Recommandé pour vous (IA)' : 'Toutes vos recettes (IA)'}>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {(filter === 'reco' ? available : available).map((r) => (
            <RecipeCard key={r.id} r={r} />
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

function RecipeCard({ r }: { r: Recipe }) {
  return (
    <article className="card" style={{ overflow: 'hidden' }}>
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
        <span className="badge">{r.minPlan}</span>
      </div>
      {r.subtitle && (
        <div className="text-sm" style={{ color: '#6b7280', marginTop: 4 }}>{r.subtitle}</div>
      )}
      <div className="text-sm" style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {typeof r.kcal === 'number' && <span className="badge">{r.kcal} kcal</span>}
        {typeof r.timeMin === 'number' && <span className="badge">{r.timeMin} min</span>}
        {r.tags.map((t) => (
          <span key={t} className="badge">{t}</span>
        ))}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary className="btn btn-outline">Détails</summary>
        <div className="text-sm" style={{ marginTop: 10 }}>
          <strong>Ingrédients</strong>
          <ul style={{ margin: '6px 0 0 16px' }}>
            {r.ingredients.map((i, idx) => <li key={idx}>{i}</li>)}
          </ul>
          <strong style={{ display: 'block', marginTop: 10 }}>Étapes</strong>
          <ol style={{ margin: '6px 0 0 16px' }}>
            {r.steps.map((s, idx) => <li key={idx}>{s}</li>)}
          </ol>
        </div>
      </details>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <a className="btn btn-dash" href={`/dashboard/recette/${r.id}`}>Voir la recette</a>
        <button className="btn btn-outline" type="button">Ajouter à mon plan</button>
      </div>
    </article>
  );
}

function LockedCard({ r, userPlan }: { r: Recipe; userPlan: Plan }) {
  const targetPlan = r.minPlan;
  const needUpgrade = targetPlan === 'PLUS' && userPlan === 'BASIC'
    ? 'PLUS'
    : targetPlan === 'PREMIUM' && userPlan !== 'PREMIUM'
    ? 'PREMIUM'
    : targetPlan;

  return (
    <article className="card" style={{ position: 'relative', overflow: 'hidden', opacity: 0.9 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent, rgba(0,0,0,.04))' }} />
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
        <span className="badge">{r.minPlan}</span>
      </div>
      {r.subtitle && (
        <div className="text-sm" style={{ color: '#6b7280', marginTop: 4 }}>{r.subtitle}</div>
      )}
      <div className="text-sm" style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {typeof r.kcal === 'number' && <span className="badge">{r.kcal} kcal</span>}
        {typeof r.timeMin === 'number' && <span className="badge">{r.timeMin} min</span>}
        {r.tags.map((t) => (
          <span key={t} className="badge">{t}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="btn btn-outline" disabled>Verrouillé</button>
        <a className="btn btn-dash" href={"/dashboard/abonnement"}>Passer à {needUpgrade}</a>
      </div>
    </article>
  );
}
