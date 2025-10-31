// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { planProgrammeFromEmail } from "../../../lib/coach/beton";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = String(
      searchParams.get("email") || cookies().get("app_email")?.value || ""
    ).trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ sessions: [], error: "Aucun email." }, { status: 200 });
    }

    // 🔹 Génération IA côté serveur à partir du Google Sheet
    const { sessions: rawSessions } = await planProgrammeFromEmail(email);

    // 🔹 Sécurité typage — on garantit que date est toujours une string, jamais null
    const sessions = (rawSessions || []).map((s, i) => ({
      ...s,
      date: s.date || "", // ✅ TS: string au lieu de null
      id: s.id || `session-${i + 1}`,
      title: s.title || `Séance ${i + 1}`,
    }));

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (e: any) {
    console.error("[API /programme] Erreur:", e);
    return NextResponse.json(
      { sessions: [], error: "Programme indisponible." },
      { status: 200 }
    );
  }
}
