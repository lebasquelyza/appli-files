// apps/web/lib/coach/ai-llm.ts
import OpenAI from "openai";
import type { AiSession, NormalizedExercise, WorkoutType } from "./ai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GenerateOpts = {
  maxSessions: number;
  today?: Date;
};

/**
 * Génère un programme via l'IA à partir d'un profil enrichi (celui que tu construis déjà dans ai.ts).
 * profile contient typiquement: prenom, age, objectif, goal, equipLevel, timePerSession,
 * level, injuries, equipItems, availabilityText, etc.
 */
export async function generateProgrammeWithLLM(
  profile: any,
  opts: GenerateOpts
): Promise<AiSession[]> {
  const { maxSessions, today = new Date() } = opts;

  const todayIso = today.toISOString().slice(0, 10);

  const systemPrompt = `
Tu es un coach sportif expert. 
Tu génères des programmes d'entraînement personnalisés à partir du profil de l'utilisateur.

Tu dois répondre STRICTEMENT en JSON valide, **sans texte autour**, de la forme :

{
  "sessions": [
    {
      "id": "string",
      "title": "string",
      "type": "muscu" | "cardio" | "hiit" | "mobilité",
      "date": "YYYY-MM-DD",
      "plannedMin": number,
      "intensity": "faible" | "modérée" | "élevée",
      "exercises": [
        {
          "name": "string",
          "sets": number,
          "reps": "string",
          "durationSec": number | null,
          "rest": "string",
          "tempo": "string",
          "rir": number,
          "load": string | number | null,
          "block": "echauffement" | "principal" | "accessoires" | "fin",
          "equipment": "string",
          "target": "string | null",
          "alt": "string | null",
          "notes": "string | null",
          "videoUrl": "string | null"
        }
      ]
    }
  ]
}

CONTRAINTES IMPORTANTES :
- Utilise le profil fourni (objectif, âge, niveau, blessures, matériel, disponibilité).
- Utilise au maximum \`availabilityText\` si présent pour décider du nombre de séances par semaine.
- Ne crée PAS plus de "maxSessions" séances.
- Durée approximative d'une séance : proche de "timePerSession" si présent, sinon 45 minutes.
- Respecte le type de séance :
  - "muscu" pour prise de muscle / force / général
  - "cardio" pour endurance
  - "mobilité" pour mobilité
  - "hiit" pour travail plus intense / perte de gras dynamique
- Les dates doivent être au format "YYYY-MM-DD".
  - Tu peux partir de "todayIso" et placer les séances sur les jours suivants.
- Les "exercises" doivent être cohérents avec le niveau et le matériel disponible.
- Réponds UNIQUEMENT avec le JSON. PAS de commentaire, PAS de texte en dehors du JSON.
`;

  const userPayload = {
    todayIso,
    maxSessions,
    profile,
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Voici le profil utilisateur et les contraintes de planification:\n\n" +
          JSON.stringify(userPayload, null, 2),
      },
    ],
  });

  let raw = completion.choices[0]?.message?.content ?? "";

  // On nettoie le cas où le modèle met des ```json ... ```
  raw = raw.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("[ai-llm] Erreur parse JSON IA", err, raw);
    throw new Error("Réponse IA invalide (JSON non parseable)");
  }

  if (!parsed || !Array.isArray(parsed.sessions)) {
    throw new Error("Réponse IA invalide: 'sessions' manquant ou non tableau");
  }

  const sessions: AiSession[] = parsed.sessions.map((s: any, idx: number) => {
    // Si la date est manquante, on en met une d'office
    let date = s.date;
    if (!date) {
      const d = new Date(today);
      d.setDate(d.getDate() + idx);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      date = `${y}-${m}-${dd}`;
    }

    const safe: AiSession = {
      id: s.id || `ai-${date}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      title: s.title || `Séance ${idx + 1}`,
      type: (s.type as WorkoutType) || "muscu",
      date,
      plannedMin: typeof s.plannedMin === "number" ? s.plannedMin : profile.timePerSession ?? 45,
      intensity: s.intensity || "modérée",
      exercises: Array.isArray(s.exercises) ? s.exercises.map(normalizeExercise) : [],
    };

    return safe;
  });

  return sessions;
}

function normalizeExercise(raw: any): NormalizedExercise {
  const ex: NormalizedExercise = {
    name: String(raw.name || "Exercice"),
    sets: typeof raw.sets === "number" ? raw.sets : undefined,
    reps: raw.reps ? String(raw.reps) : undefined,
    durationSec:
      typeof raw.durationSec === "number"
        ? raw.durationSec
        : undefined,
    rest: raw.rest ? String(raw.rest) : undefined,
    tempo: raw.tempo ? String(raw.tempo) : undefined,
    rir: typeof raw.rir === "number" ? raw.rir : undefined,
    load: raw.load,
    block: raw.block,
    equipment: raw.equipment ? String(raw.equipment) : undefined,
    target: raw.target ? String(raw.target) : undefined,
    alt: raw.alt ? String(raw.alt) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
    videoUrl: raw.videoUrl ? String(raw.videoUrl) : undefined,
  };

  return ex;
}
