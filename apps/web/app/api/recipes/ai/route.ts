import { NextResponse } from "next/server";

export async function GET() {
  // Test rapide dans le navigateur
  return NextResponse.json(
    { ok: true, route: "/api/recipes/ai", method: "GET" },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  console.log("[API] /api/recipes/ai HIT (POST)");

  return NextResponse.json(
    {
      recipes: [
        {
          id: "debug-recipe",
          title: "Recette debug IA",
          subtitle: "Si tu vois ça, la route fonctionne",
          kcal: 500,
          timeMin: 15,
          tags: ["debug"],
          goals: ["equilibre"],
          minPlan: "PLUS",
          ingredients: ["test 1", "test 2"],
          steps: ["Étape 1", "Étape 2", "Étape 3"],
        },
      ],
    },
    { status: 200 }
  );
}
