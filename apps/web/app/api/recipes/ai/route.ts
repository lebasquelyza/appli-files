import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Plan = "BASIC" | "PLUS" | "PREMIUM";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = 15000;

// Fallback simple si l'IA est KO (timeout / fetch error)
function fallbackRecipes(kind: "meals" | "shakes") {
  if (kind === "shakes") {
    return [
      {
        id: "fallback-shake-choco",
        title: "Shake choco protéiné (fallback)",
        subtitle: "Banane, lait, whey chocolat",
        kcal: 350,
        timeMin: 5,
        tags: ["shake", "rapide", "protéiné"],
        goals: ["equilibre"],
        minPlan: "BASIC" as Plan,
        ingredients: [
          "lait (ou lait végétal)",
          "banane",
          "whey chocolat",
          "beurre de cacahuète (option)",
          "glaçons",
        ],
        steps: [
          "Mettre tous les ingrédients dans le blender.",
          "Mixer jusqu'à texture lisse.",
          "Goûter et ajuster avec lait ou glaçons.",
        ],
      },
      {
        id: "fallback-shake-fruits",
        title: "Smoothie fruits rouges protéiné (fallback)",
        subtitle: "Yaourt grec, fruits rouges",
        kcal: 320,
        timeMin: 5,
        tags: ["shake", "fruité"],
        goals: ["equilibre"],
        minPlan: "BASIC" as Plan,
        ingredients: [
          "fruits rouges surgelés",
          "yaourt grec 0%",
          "lait (ou lait végétal)",
          "whey neutre ou vanille",
          "miel ou édulcorant (option)",
        ],
        steps: [
          "Mettre fruits, yaourt, whey et lait dans le blender.",
          "Mixer finement.",
          "Sucrer légèrement si besoin.",
        ],
      },
    ];
  }

  // kind === "meals"
  return [
    {
      id: "fallback-bowl-poulet",
      title: "Bowl poulet & riz (fallback IA)",
      subtitle: "Version équilibrée rapide",
      kcal: 600,
      timeMin: 20,
      tags: ["protéiné", "equilibre"],
      goals: ["equilibre"],
      minPlan: "BASIC" as Plan,
      ingredients: [
        "poulet",
        "riz complet",
        "avocat",
        "tomates cerises",
        "maïs",
        "huile d'olive",
        "citron",
        "sel",
        "poivre",
      ],
      steps: [
        "Cuire le riz complet selon les indications.",
        "Saisir le poulet en dés avec sel, poivre et un filet d'huile.",
        "Assembler dans un bol : riz, poulet, avocat, tomates et maïs, arroser de citron.",
      ],
    },
    {
      id: "fallback-salade-legumes",
      title: "Salade complète légumes & pois chiches (fallback IA)",
      subtitle: "Froide, rapide, riche en fibres",
      kcal: 500,
      timeMin: 15,
      tags: ["végétarien", "equilibre"],
      goals: ["equilibre"],
      minPlan: "BASIC" as Plan,
      ingredients: [
        "pois chiches en boîte",
        "concombre",
        "poivron",
        "tomates",
        "feta (ou tofu)",
        "huile d'olive",
        "citron",
        "herbes (persil, ciboulette)",
        "sel",
        "poivre",
      ],
      steps: [
        "Rincer et égoutter les pois chiches.",
        "Couper les légumes en dés et la feta.",
        "Mélanger le tout avec huile d'olive, citron, herbes, sel et poivre.",
      ],
    },
  ];
}

async function callOpenAI(prompt: string, apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    console.log("[recipes/ai] Appel OpenAI…");

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Tu parles français et tu réponds en JSON strict." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[recipes/ai] OPENAI_HTTP_ERROR", res.status, errText);
      return { ok: false, error: "OPENAI_HTTP_ERROR", detail: errText };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      console.error("[recipes/ai] OPENAI_TIMEOUT");
      return {
        ok: false,
        error: "OPENAI_TIMEOUT",
        detail: `Timeout après ${OPENAI_TIMEOUT_MS}ms`,
      };
    }

    console.error("[recipes/ai] OPENAI_FETCH_ERROR", e);
    return {
      ok: false,
      error: "OPENAI_FETCH_ERROR",
      detail: String(e?.message ?? e),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[recipes/ai] Pas de OPENAI_API_KEY dans l'env");
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

    const result = await callOpenAI(prompt, apiKey);

    if (!result.ok) {
      // Si timeout ou fetch error → on renvoie un fallback IA
      if (result.error === "OPENAI_TIMEOUT" || result.error === "OPENAI_FETCH_ERROR") {
        console.warn("[recipes/ai] IA KO, utilisation des recettes fallback");
        return NextResponse.json({ recipes: fallbackRecipes(mode) }, { status: 200 });
      }

      // Autres erreurs: on renvoie error pour que le front affiche "IA indisponible..."
      return NextResponse.json(
        { recipes: [], error: result.error, detail: result.detail },
        { status: 200 }
      );
    }

    const data = result.data as any;
    let payload: any = {};
    try {
      payload = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    } catch (e) {
      console.error("[recipes/ai] PARSE_ERROR", e);
      return NextResponse.json({ recipes: [], error: "PARSE_ERROR" }, { status: 200 });
    }

    const arr: any[] = Array.isArray(payload?.recipes) ? payload.recipes : [];
    console.log("[recipes/ai] OK, recettes générées:", arr.length);
    return NextResponse.json({ recipes: arr }, { status: 200 });
  } catch (e: any) {
    console.error("[recipes/ai] FATAL_ERROR", e);
    return NextResponse.json(
      { recipes: [], error: "FATAL_ERROR", detail: String(e?.message ?? e) },
      { status: 200 }
    );
  }
}
