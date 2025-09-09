// app/dashboard/recipes/[id]/page.tsx
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

function parseCsv(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw.split(/[,|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function normalizeGoals(s: any): string[] {
  const raw = s?.goals ?? s?.objectifs ?? s?.goal ?? s?.objectif ?? [];
  const arr = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,|]/);
  return arr.map((x) => x.toString().trim().toLowerCase()).filter(Boolean);
}
function planRank(p?: Plan) { return p === "PREMIUM" ? 3 : p === "PLUS" ? 2 : 1; }

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

async function generateSingleRecipe({
  id, plan, goals, kcalTarget, kcalMin, kcalMax, allergens, diets,
}: {
  id: string; plan: Plan; goals: string[];
  kcalTarget?: number; kcalMin?: number; kcalMax?: number;
  allergens: string[]; diets: string[];
}): Promise<Recipe | null> {
  const constraints: string[] = [];
  if (typeof kcalTarget === "number" && !isNaN(kcalTarget)) constraints.push(`- Viser ~${kcalTarget} kcal (±10%).`);
  else {
    if (typeof kcalMin === "number" && !isNaN(kcalMin)) constraints.push(`- Min ${kcalMin} kcal.`);
    if (typeof kcalMax === "number" && !isNaN(kcalMax)) constraints.push(`- Max ${kcalMax} kcal.`);
  }
  if (allergens.length) constraints.push(`- Exclure: ${allergens.join(", ")}.`);
  if (diets.length) constraints.push(`- Régimes: ${diets.join(", ")}.`);

  const planRule =
    plan === "BASIC" ? "- Recette BASIC." :
    plan === "PLUS"  ? "- Recette PLUS (ou BASIC)." :
                        "- Recette PREMIUM (ou mieux).";

  const user = [
    `ID_RECETTE: ${id}`,
    `PLAN_UTILISATEUR: ${plan}`,
    `OBJECTIFS: ${goals.join(", ") || "equilibre"}`,
    "",
    "CONTRAINTE DE SORTIE:",
    '- Renvoie un objet JSON: {"recipe": Recipe}',
    "",
    "CONTRAINTES RECETTE:",
    planRule,
    "- Inclure: title, subtitle?, kcal?, timeMin?, tags[], goals[], minPlan, ingredients[], steps[].",
    constraints.length ? constraints.join("\n") : "",
    "",
    "SCHEMA:",
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
    `- Utiliser exactement id = "${id}".`,
    "Exige JSON STRICT, sans explication.",
  ].filter(Boolean).join("\n");

  const payload = await callOpenAIChatJSON(user);
  const r = payload?.recipe;
  if (!r) return null;

  const cleaned: Recipe = {
    id,
    title: String(r.title || "").trim(),
    subtitle: r.subtitle ? String(r.subtitle).trim() : undefined,
    kcal: typeof r.kcal === "number" ? r.kcal : undefined,
    timeMin: typeof r.timeMin === "number" ? r.timeMin : undefined,
    tags: Array.isArray(r.tags) ? r.tags.map((t: any) => String(t).trim()) : [],
    goals: Array.isArray(r.goals) ? r.goals.map((g: any) => String(g).trim()) : [],
    minPlan: (["BASIC","PLUS","PREMIUM"].includes(r.minPlan) ? r.minPlan : "BASIC") as Plan,
    ingredients: Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => String(i)) : [],
    steps: Array.isArray(r.steps) ? r.steps.map((s: any) => String(s)) : [],
  };
  if (!cleaned.title || cleaned.ingredients.length < 3 || cleaned.steps.length < 2) return null;
  return cleaned;
}

export default async function Page({
  params, searchParams,
}: {
  params: { id: string };
  searchParams?: { kcal?: string; kcalMin?: string; kcalMax?: string; allergens?: string; diets?: string; };
}) {
  const s = await getSession();
  const plan: Plan = (s?.plan as Plan) || "BASIC";
  const goals = normalizeGoals(s);

  const kcal      = Number(searchParams?.kcal ?? "");
  const kcalMin   = Number(searchParams?.kcalMin ?? "");
  const kcalMax   = Number(searchParams?.kcalMax ?? "");
  const allergens = parseCsv(searchParams?.allergens);
  const diets     = parseCsv(searchParams?.diets);

  const r = await generateSingleRecipe({
    id: params.id,
    plan,
    goals,
    kcalTarget: !isNaN(kcal) && kcal > 0 ? kcal : undefined,
    kcalMin:    !isNaN(kcalMin) && kcalMin > 0 ? kcalMin : undefined,
    kcalMax:    !isNaN(kcalMax) && kcalMax > 0 ? kcalMax : undefined,
    allergens, diets,
  });

  if (!r) {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <h1 className="h1">Recette introuvable</h1>
        <p className="lead">Impossible de générer cette recette. Réessayez depuis la liste.</p>
        <a href="/dashboard/recipes" className="btn btn-dash" style={{ marginTop: 12 }}>Retour aux recettes</a>
      </div>
    );
  }

  // Contrôle d'accès selon plan
  if (planRank(plan) < planRank(r.minPlan)) {
    const need = r.minPlan === "PREMIUM" ? "PREMIUM" : "PLUS";
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <h1 className="h1" style={{ marginBottom: 6 }}>{r.title}</h1>
        <p className="lead" style={{ marginBottom: 16 }}>Cette recette est réservée au plan {r.minPlan}.</p>
        <a className="btn btn-dash" href="/dashboard/abonnement">Passer à {need}</a>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <h1 className="h1" style={{ marginBottom: 6 }}>{r.title}</h1>
      {r.subtitle && <p className="lead">{r.subtitle}</p>}

      <div className="section" style={{ marginTop: 12 }}>
        <div className="text-sm" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="badge">{r.minPlan}</span>
          {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
          {typeof r.timeMin === "number" && <span className="badge">{r.timeMin} min</span>}
          {r.tags.map((t) => <span key={t} className="badge">{t}</span>)}
        </div>

        <div className="grid gap-6 lg:grid-cols-2" style={{ marginTop: 12 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Ingrédients</h2>
            <ul style={{ margin: "6px 0 0 16px" }}>
              {r.ingredients.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Étapes</h2>
            <ol style={{ margin: "6px 0 0 16px" }}>
              {r.steps.map((s, idx) => <li key={idx}>{s}</li>)}
            </ol>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <a href="/dashboard/recipes" className="btn btn-outline">← Retour</a>
          <button className="btn btn-dash" type="button">Ajouter à mon plan</button>
        </div>
      </div>
    </div>
  );
}
