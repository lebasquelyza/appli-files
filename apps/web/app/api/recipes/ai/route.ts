// apps/web/app/api/recipes/ai/route.ts
import { NextResponse } from "next/server";
import {
  generateRecipesFromFilters,
  type GenerateRecipesInput,
} from "../../../../lib/recipes/ai";

export const runtime = "nodejs";

type Plan = "BASIC" | "PLUS" | "PREMIUM";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[recipes/ai] Pas de OPENAI_API_KEY dans l'env");
      // 100 % IA : pas de fallback, juste erreur
      return NextResponse.json(
        { recipes: [], error: "NO_API_KEY" },
        { status: 200 },
      );
    }

    const body = await req.json().catch(() => ({}));

    const {
      plan = "PLUS",
      kcal,
      kcalMin,
      kcalMax,
      allergens = [],
      dislikes = [],
      count = 8,
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

    const input: GenerateRecipesInput = {
      plan,
      kind: kind === "shakes" ? "shakes" : "meals",
      kcal,
      kcalMin,
      kcalMax,
      allergens,
      dislikes,
      count: Math.max(1, Math.min(count || 8, 12)), // petit garde-fou
    };

    const { recipes } = await generateRecipesFromFilters(input);

    return NextResponse.json({ recipes }, { status: 200 });
  } catch (e: any) {
    console.error("[recipes/ai] Erreur:", e);
    const code = e?.message === "PARSE_ERROR" ? "PARSE_ERROR" : "FATAL_ERROR";
    return NextResponse.json(
      { recipes: [], error: code, detail: String(e?.message ?? e) },
      { status: 200 },
    );
  }
}
