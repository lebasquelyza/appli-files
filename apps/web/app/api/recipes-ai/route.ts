import { NextResponse } from "next/server";

type Plan = "BASIC" | "PLUS" | "PREMIUM";

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ recipes: [], error: "NO_API_KEY" }, { status: 200 });
  }

  const body = await req.json().catch(() => ({}));

  const {
    plan = "PLUS",
    kcal,
    kcalMin,
    kcalMax,
    allergens = [],
    dislikes = [],
    count = 12,
    kind = "meals",
  } = body as {
    plan?: Plan;
    kcal?: number;
    kcalMin?: number;
    kcalMax?: number;
    allergens?: string[];
    dislikes?: string[];
    count?: number;
    kind?: "meals" | "shakes";
  };

  const mode: "meals" | "shakes" = kind === "shakes" ? "shakes" : "meals";

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
  if (dislikes.length)
    constraints.push(
      `- Si un ingrédient non-aimé apparaît, ne pas le supprimer: proposer une section "rework" avec 2-3 façons de le cuisiner autrement.`
    );

  const typeLine =
    mode === "shakes"
      ? "- Toutes les recettes sont des BOISSONS protéinées (shakes / smoothies) à boire, préparées au blender, prêtes en 5–10 min. Pas de plats solides."
      : "- Recettes de repas (petit-déjeuner, déjeuner, dîner, bowls, etc.).";

  const prompt = `Tu es un chef-nutritionniste. Renvoie UNIQUEMENT du JSON valide (pas de texte).
Utilisateur:
- Plan: ${plan}
- Type de recettes: ${mode === "shakes" ? "shakes / smoothies protéinés" : "repas (plats)"}
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
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { recipes: [], error: "OPENAI_HTTP_ERROR", detail: errText },
        { status: 200 }
      );
    }

    const data = await res.json();
    let payload: any = {};
    try {
      payload = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    } catch {
      return NextResponse.json({ recipes: [], error: "PARSE_ERROR" }, { status: 200 });
    }

    const arr: any[] = Array.isArray(payload?.recipes) ? payload.recipes : [];
    return NextResponse.json({ recipes: arr }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { recipes: [], error: "FETCH_ERROR", detail: String(e?.message ?? e) },
      { status: 200 }
    );
  }
}
