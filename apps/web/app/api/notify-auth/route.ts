import { NextRequest, NextResponse } from "next/server";

const RESEND_API_URL = "https://api.resend.com/emails";

// option recommandé : clé dans une variable d'env (Netlify)
// tu peux la mettre dans les "Environment variables" Netlify : RESEND_API_KEY=...
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// si tu refuses vraiment les env vars, tu peux À LA PLACE hardcoder ta clé ici :
// const RESEND_API_KEY = "TA_CLE_API_RESEND";

export async function POST(req: NextRequest) {
  try {
    const { type, userEmail } = await req.json();

    if (!type || !userEmail) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY manquante");
      return NextResponse.json({ error: "Missing API key" }, { status: 500 });
    }

    const actionText =
      type === "login" ? "s'est connecté" : "a créé un compte";

    const subject =
      type === "login"
        ? "Nouvelle connexion sur Files Coaching"
        : "Nouveau compte créé sur Files Coaching";

    // Appel HTTP vers Resend (aucune lib externe)
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Files Coaching <onboarding@resend.dev>", // ou ton domaine validé
        to: ["sportifandpro@gmail.com"],
        subject,
        text: `Un utilisateur ${actionText} : ${userEmail}`,
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("Resend error:", response.status, txt);
      return NextResponse.json({ error: "Mail provider error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("notify-auth error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

