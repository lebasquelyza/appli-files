// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateProgrammeFromAnswers,
  buildProfileFromAnswers,
} from "../../../lib/coach/ai";

// Utilitaire : transforme le texte de dispo en jours de semaine
function parseAvailableDays(text?: string | null): number[] {
  if (!text) return [];
  const s = String(text).toLowerCase();
  const map: Record<string, number> = {
    dimanche: 0,
    lundi: 1,
    mardi: 2,
    mercredi: 3,
    jeudi: 4,
    vendredi: 5,
    samedi: 6,
  };
  const out: number[] = [];
  for (const k of Object.keys(map)) {
    if (new RegExp(`\\b${k}\\b`, "i").test(s)) out.push(map[k]);
  }
  // si pas de jours textuels → détecte "3x/sem" etc.
  if (!out.length) {
    const m = s.match(/\b([1-7])\s*(x|fois|j|jour|jours)/i);
    if (m) {
      const n = Math.min(6, Math.max(1, parseInt(m[1], 10)));
      const today = new Date();
      for (let i = 0; i < n; i++) out.push((today.getDay() + i) % 7);
    }
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

// Génère les dates futures correspondant aux jours trouvés
function nextDatesForDays(days: number[], count: number): string[] {
  const res: string[] = [];
  const today = new Date();
  for (let i = 0; res.length < count && i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (days.includes(d.getDay())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      res.push(`${y}-${m}-${dd}`);
    }
  }
  return res;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const answers = body?.answers;
    if (!answers) {
      return NextResponse.json({ sessions: [], error: "Réponses manquantes" }, { status: 400 });
    }

    // 1️⃣ Construit un profil enrichi pour l’IA
    const profile = buildProfileFromAnswers(answers);

    // 2️⃣ Appelle la génération IA complète
    const prog = generateProgrammeFromAnswers(answers);
    let sessions = prog?.sessions || [];

    // 3️⃣ Planifie : 1 jour dispo = 1 séance
    const availText =
      answers["availabilityText"] ||
      answers["daysPerWeekText"] ||
      answers["jours"] ||
      answers["séances/semaine"] ||
      answers["seances/semaine"] ||
      "";
    const availDays = parseAvailableDays(availText);
    const count = Math.min(6, Math.max(1, sessions.length || 3));
    const dates = availDays.length ? nextDatesForDays(availDays, count) : [];

    sessions = sessions.slice(0, count).map((s, i) => ({
      ...s,
      date: s.date || dates[i] || null,
    }));

    // 4️⃣ Sauvegarde simple côté cookie (pour éviter la régénération sur la page séance)
    const cookieStore = cookies();
    const store = { sessions };
    cookieStore.set("app_sessions", JSON.stringify(store), {
      path: "/",
      httpOnly: false,
      maxAge: 60 * 60 * 24, // 24h
    });

    // 5️⃣ Retourne le programme complet
    return NextResponse.json({ sessions, email, profile });
  } catch (err) {
    console.error("Erreur API /programme:", err);
    return NextResponse.json(
      { sessions: [], error: "Erreur lors de la génération IA." },
      { status: 500 }
    );
  }
}
