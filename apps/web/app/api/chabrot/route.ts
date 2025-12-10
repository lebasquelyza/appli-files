// apps/web/app/api/chabrot/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, lang } = body as {
      messages: { role: "user" | "assistant" | "system"; content: string }[];
      lang?: "fr" | "en";
    };

    const systemPromptFr = `
Tu es "Chabrot", un assistant nutrition et coaching bienveillant intégré à une app de suivi (calories, recettes, progression, motivation).
Tu réponds en français, de façon courte, claire et rassurante.
Tu peux faire référence aux sections du dashboard: calories, recettes, files/correcteur, profil, progression, motivation, etc.
`;

    const systemPromptEn = `
You are "Chabrot", a kind nutrition and coaching assistant integrated into a tracking app (calories, recipes, progress, motivation).
You answer in English, short, clear and reassuring.
You can refer to dashboard sections: calories, recipes, corrector, profile, progress, motivation, etc.
`;

    const system = lang === "en" ? systemPromptEn : systemPromptFr;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini", // ou autre modèle que tu préfères
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const reply = response.choices[0]?.message?.content ?? "";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Error in /api/chabrot:", err);
    return NextResponse.json(
      { error: "Erreur Chabrot" },
      { status: 500 }
    );
  }
}
