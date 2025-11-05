import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Plan = "BASIC" | "PLUS" | "PREMIUM";
type Rework = { ingredient: string; tips: string[] };
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
  rework?: Rework[];
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const {
      kind,
      kcal,
      kcalMin,
      kcalMax,
      allergens = [],
      dislikes = [],
      count = 8,
    } = body as {
      kind: "meals" | "shakes";
      kcal?: number;
      kcalMin?: number;
      kcalMax?: number;
      allergens?: string[];
      dislikes?: string[];
      count?: number;
    };

    const plan: Plan = "PLUS";
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { recipes: [], error: "missing_api_key" },
        { status: 200 }
      );
    }

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
      kind === "shakes"
        ? "- Toutes les recettes sont des BOISSONS protéinées (shakes / smoothies) à boire, préparées au blender, prêtes en 5–10 min. Pas de plats solides."
        : "- Recettes de repas (petit-déjeuner, déjeuner, dîner, bowls, etc.).";

    const prompt = `Tu es un chef-nutritionniste. Renvoie UNIQUEMENT du JSON valide (pas de texte).
Utilisateur:
- Plan: ${plan}
- Type de recettes: ${kind === "shakes" ? "shakes / smoothies protéinés" : "repas (plats)"}
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
- Ajouter le tag "perso-ia" dans tags pour toutes les recettes.
- Renvoyer {"recipes": Recipe[]}.`;

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
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { recipes: [], error: "openai_http_error" },
        { status: 200 }
      );
    }

    const data = await res.json().catch(() => ({} as any));
    let payload: any = {};
    try {
      payload = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    } catch {
      return NextResponse.json(
        { recipes: [], error: "openai_parse_error" },
        { status: 200 }
      );
    }

    const arr: any[] = Array.isArray(payload?.recipes) ? payload.recipes : [];
    const seen = new Set<string>();

    const recipes: Recipe[] = arr
      .map((raw) => {
        const title = String(raw?.title ?? "").trim();
        if (!title) return null;

        const id = String(raw?.id || title || Math.random().toString(36).slice(2))
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-");

        let tags: string[] = Array.isArray(raw?.tags)
          ? raw.tags.map((t: any) => String(t))
          : [];
        if (!tags.some((t) => t.toLowerCase() === "perso-ia")) {
          tags = [...tags, "perso-ia"];
        }

        const rework: Rework[] | undefined = Array.isArray(raw?.rework)
          ? raw.rework.map((x: any) => ({
              ingredient: String(x?.ingredient || "").toLowerCase(),
              tips: Array.isArray(x?.tips) ? x.tips.map((t: any) => String(t)) : [],
            }))
          : undefined;

        const ingredients: string[] = Array.isArray(raw?.ingredients)
          ? raw.ingredients.map((x: any) => String(x))
          : [];
        const steps: string[] = Array.isArray(raw?.steps)
          ? raw.steps.map((x: any) => String(x))
          : [];

        return {
          id,
          title,
          subtitle: raw?.subtitle ? String(raw.subtitle) : undefined,
          kcal: typeof raw?.kcal === "number" ? raw.kcal : undefined,
          timeMin: typeof raw?.timeMin === "number" ? raw.timeMin : undefined,
          tags,
          goals: Array.isArray(raw?.goals) ? raw.goals.map((g: any) => String(g)) : [],
          minPlan: plan,
          ingredients,
          steps,
          rework,
        } as Recipe;
      })
      .filter((r): r is Recipe => !!r)
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        const ingLow = r.ingredients.map((i) => i.toLowerCase());
        if (allergens.some((a) => ingLow.includes(a))) return false;
        return true;
      });

    return NextResponse.json({ recipes }, { status: 200 });
  } catch {
    return NextResponse.json(
      { recipes: [], error: "server_error" },
      { status: 200 }
    );
  }
}
