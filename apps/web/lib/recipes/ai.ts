// apps/web/lib/recipes/ai.ts
import OpenAI from "openai";

type Plan = "BASIC" | "PLUS" | "PREMIUM";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type GenerateRecipesInput = {
  plan: Plan;
  kind: "meals" | "shakes";
  kcal?: number;
  kcalMin?: number;
  kcalMax?: number;
  allergens: string[];
  dislikes: string[];
  count: number;
};

export async function generateRecipesFromFilters(input: GenerateRecipesInput) {
  const {
    plan,
    kind,
    kcal,
    kcalMin,
    kcalMax,
    allergens,
    dislikes,
    count,
  } = input;

  const mode: "meals" | "shakes" = kind === "shakes" ? "shakes" : "meals";

  const constraints: string[] = [];

  if (typeof kcal === "number" && !isNaN(kcal) && kcal > 0) {
    constraints.push(`- Viser ~${kcal} kcal par recette (±10%).`);
  } else {
    const hasMin =
      typeof kcalMin === "number" && !isNaN(kcalMin) && kcalMin > 0;
    const hasMax =
      typeof kcalMax === "number" && !isNaN(kcalMax) && kcalMax > 0;
    if (hasMin && hasMax)
      constraints.push(`- Respecter une plage ${kcalMin}-${kcalMax} kcal.`);
    else if (hasMin) constraints.push(`- Minimum ${kcalMin} kcal.`);
    else if (hasMax) constraints.push(`- Maximum ${kcalMax} kcal.`);
  }

  if (allergens.length)
    constraints.push(`- Exclure strictement: ${allergens.join(", ")}.`);
  if (dislikes.length)
    constraints.push(
      `- Si un ingrédient non-aimé apparaît, ne pas le supprimer: proposer une section "rework" avec 2-3 façons de le cuisiner autrement.`,
    );

  const typeLine =
    mode === "shakes"
      ? '- Toutes les recettes sont des BOISSONS protéinées (shakes / smoothies) à boire, préparées au blender, prêtes en 5–10 min. Pas de plats solides.'
      : "- Recettes de repas (petit-déjeuner, déjeuner, dîner, bowls, etc.).";

  const prompt = `Tu es un chef-nutritionniste. Renvoie UNIQUEMENT du JSON valide (pas de texte).
Utilisateur:
- Plan: ${plan}
- Type de recettes: ${
    mode === "shakes" ? "shakes / smoothies protéinés" : "repas (plats)"
  }
- Allergènes/Intolérances: ${allergens.join(", ") || "aucun"}
- Aliments non aimés (à re-travailler): ${dislikes.join(", ") || "aucun"}
- Nombre de recettes: ${count}

Contraintes:
${typeLine}
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
- Pour le mode "shakes": uniquement des boissons à boire, préparation au blender, 5–10 min.
- Renvoyer {"recipes": Recipe[]}.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Tu parles français et tu réponds en JSON strict.",
      },
      { role: "user", content: prompt },
    ],
  });

  let payload: any = {};
  try {
    payload = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  } catch (e) {
    console.error("[recipes/ai] PARSE_ERROR", e);
    throw new Error("PARSE_ERROR");
  }

  const recipes: any[] = Array.isArray(payload?.recipes)
    ? payload.recipes
    : [];

  return { recipes };
}
