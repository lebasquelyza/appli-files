import { NextResponse } from "next/server";

export const runtime = "nodejs"; // exécution côté Node

type Plan = "BASIC" | "PLUS" | "PREMIUM";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = 15000; // 15s max

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
      // On renvoie 200 pour que le front ne traite pas ça comme une erreur HTTP
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
