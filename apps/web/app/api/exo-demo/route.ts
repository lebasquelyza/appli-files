import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs"; // ensure server runtime

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

type ExoRequest = {
  exercise: string;
  level?: "debutant" | "intermediaire" | "avance" | string;
  injuries?: string[];
  goalKey?: string; // hypertrophy|strength|fatloss|...
  language?: string; // "fr" by default
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExoRequest;
    const exercise = (body.exercise || "").trim();
    if (!exercise) {
      return NextResponse.json({ error: "Missing exercise" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const language = body.language || "fr";
    const level = body.level || "débutant";
    const injuries = (body.injuries || []).join(", ") || "aucune";
    const goalKey = body.goalKey || "general";

    const system = [
      "Tu es un coach sportif certifié.",
      "Réponds STRICTEMENT en JSON valide (pas de texte hors JSON).",
      "Le JSON doit contenir:",
      "- animation (nom de fichier .glb attendu côté front, ex: 'squat.glb')",
      "- tempo (ex: '3011')",
      "- cues (array de 3 à 6 consignes courtes)",
      "- errors (array des 3 erreurs fréquentes)",
      "- progression (une variante plus difficile)",
      "- regression (une variante plus facile)",
      "- camera (ex: '3/4 avant', optionnel)",
      "- videoKeywords (mots-clés YouTube FR pour fallback vidéo)",
    ].join(" ");

    const user = [
      `Exercice: ${exercise}`,
      `Niveau: ${level}`,
      `Blessures: ${injuries}`,
      `Objectif: ${goalKey}`,
      `Langue: ${language}`,
      `Donne un JSON concis. Si l'exercice est ambigu, choisis la variante la plus standard.`
    ].join("\n");

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const resp = await client.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = resp.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { error: "Invalid JSON from model", raw: content };
    }

    // minimal sanity defaults
    if (!parsed.animation) parsed.animation = "squat.glb";
    if (!parsed.tempo) parsed.tempo = "3011";
    if (!Array.isArray(parsed.cues)) parsed.cues = [];
    if (!Array.isArray(parsed.errors)) parsed.errors = [];
    if (!parsed.videoKeywords) parsed.videoKeywords = `${exercise} exercice tutoriel`;

    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
