// lib/recipes/ai.ts
import OpenAI from "openai";

export type Plan = "BASIC" | "PLUS" | "PREMIUM";

export type GenerateRecipesInput = {
  plan: Plan;
  kind: "meals" | "shakes" | "breakfast";
  kcal?: number;
  kcalMin?: number;
  kcalMax?: number;
  allergens: string[];
  dislikes: string[];
  count: number;
  /** Nombre aléatoire envoyé depuis le front pour varier les recettes (seed) */
  rnd?: number;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Saison simple pour l’hémisphère nord (France/Europe) */
function getSeason(date: Date): "winter" | "spring" | "summer" | "autumn" {
  const month = date.getMonth() + 1; // 1-12
  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "autumn";
}

export async function generateRecipesFromFilters(
  input: GenerateRecipesInput,
) {
  const {
    plan,
    kind,
    kcal,
    kcalMin,
    kcalMax,
    allergens,
    dislikes,
    count,
    rnd,
  } = input;

  const mode: "meals" | "shakes" | "breakfast" =
    kind === "shakes" ? "shakes" : kind === "breakfast" ? "breakfast" : "meals";

  // Saison actuelle (France / Europe)
  const now = new Date();
  const season = getSeason(now);

  const seasonLabelFR =
    season === "winter"
      ? "hiver"
      : season === "spring"
      ? "printemps"
      : season === "summer"
      ? "été"
      : "automne";

  // On limite un peu pour éviter les réponses énormes (et les timeout)
  const safeCount = Math.max(1, Math.min(count || 3, 6));

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

  if (allergens.length) {
    constraints.push(`- Exclure strictement: ${allergens.join(", ")}.`);
  }

  if (dislikes.length) {
    constraints.push(
      `- Si un ingrédient non-aimé apparaît, ne pas le supprimer: proposer une section "rework" avec 2-3 façons de le cuisiner autrement.`,
    );
  }

  // Contrainte "produits de saison"
  constraints.push(
    `- Utiliser autant que possible des produits de saison (${seasonLabelFR}) disponibles en France/Europe.`,
  );

  const typeLine =
    mode === "shakes"
      ? '- Toutes les recettes sont des BOISSONS protéinées (shakes / smoothies) à boire, préparées au blender, prêtes en 5–10 min. Pas de plats solides.'
      : mode === "breakfast"
      ? "- Recettes de petit-déjeuner (sucrées ou salées : porridges, tartines, œufs, pancakes, yaourts, etc.). Préparation simple, faisable le matin."
      : "- Recettes de repas (déjeuner, dîner, bowls, etc.).";

  // Est-ce qu'il y a au moins une contrainte ?
  const hasAnyConstraint =
    (typeof kcal === "number" && !isNaN(kcal) && kcal > 0) ||
    (typeof kcalMin === "number" && !isNaN(kcalMin) && kcalMin > 0) ||
    (typeof kcalMax === "number" && !isNaN(kcalMax) && kcalMax > 0) ||
    allergens.length > 0 ||
    dislikes.length > 0;

  // Si l'utilisateur ne donne aucune contrainte, on met plus de variété
  const temperature = hasAnyConstraint ? 0.7 : 0.9;

  // Petit hint pour la variété, basé sur rnd
  const randomHint =
    typeof rnd === "number"
      ? `- Contexte aléatoire (seed numérique): ${rnd}. Utilise ce nombre pour varier les idées de recettes même si les contraintes sont identiques.`
      : "- Si l'utilisateur donne peu ou pas de contraintes, propose des recettes variées à chaque appel (ne pas toujours renvoyer les mêmes).";

  // Contexte saisonnier plus précis selon la saison + le type de recettes
  let seasonHint = "";
  if (season === "winter") {
    if (mode === "shakes") {
      seasonHint =
        "- On est en hiver : privilégier des boissons réconfortantes (chocolat chaud, épices type cannelle/gingembre, textures onctueuses), éviter les recettes trop glacées.";
    } else if (mode === "breakfast") {
      seasonHint =
        "- On est en hiver : proposer des petits-déjeuners chauds et réconfortants (porridge chaud, œufs, tartines, pancakes, boissons chaudes).";
    } else {
      seasonHint =
        "- On est en hiver : proposer surtout des plats chauds, mijotés, gratins, soupes, four, poêlée, avec légumes de saison (courge, poireau, chou, carotte, pomme de terre, etc.).";
    }
  } else if (season === "summer") {
    if (mode === "shakes") {
      seasonHint =
        "- On est en été : proposer des shakes très frais, fruits d'été, glace pilée, textures légères, recettes rafraîchissantes.";
    } else if (mode === "breakfast") {
      seasonHint =
        "- On est en été : petits-déjeuners frais (yaourt, fruits, smoothies bowl, tartines légères), éviter les plats trop lourds.";
    } else {
      seasonHint =
        "- On est en été : privilégier des plats frais ou rapides (salades, bowls, grillades, poêlées légères), éviter les gros plats très lourds.";
    }
  } else if (season === "spring") {
    seasonHint =
      "- On est au printemps : mettre en avant des recettes plutôt légères, avec des légumes de printemps (asperge, petits pois, carotte nouvelle, épinard, radis, etc.).";
  } else if (season === "autumn") {
    seasonHint =
      "- On est en automne : proposer des recettes progressivement plus réconfortantes, avec courges, champignons, poireaux, et des plats qui peuvent être servis chauds.";
  }

  const typeLabel =
    mode === "shakes"
      ? "shakes / smoothies protéinés"
      : mode === "breakfast"
      ? "petits-déjeuners (sucrés ou salés)"
      : "repas (plats)";

  const prompt = `Tu es un chef-nutritionniste. Renvoie UNIQUEMENT du JSON valide (pas de texte).
Utilisateur:
- Plan: ${plan}
- Type de recettes: ${typeLabel}
- Saison actuelle: ${seasonLabelFR} (France / Europe, hémisphère nord)
- Allergènes/Intolérances: ${allergens.join(", ") || "aucun"}
- Aliments non aimés (à re-travailler): ${dislikes.join(", ") || "aucun"}
- Nombre de recettes: ${safeCount}

Contexte saisonnier:
${seasonHint || "- Adapter les recettes à la saison actuelle."}

Contraintes:
${typeLine}
${constraints.join("\n")}
${randomHint}

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
- Pour le mode "breakfast": formats adaptés au petit-déjeuner (sucré ou salé), préparation généralement ≤ 15 min.
- Respecter autant que possible la saison (${seasonLabelFR}) dans le choix des recettes.
- Renvoyer {"recipes": Recipe[]}.`;

  console.time("[recipes/ai] openai");
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Tu parles français et tu réponds en JSON strict.",
      },
      { role: "user", content: prompt },
    ],
  });
  console.timeEnd("[recipes/ai] openai");

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
