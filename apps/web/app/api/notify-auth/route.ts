// apps/web/app/api/notify-auth/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";           // même logique que send-reset
export const dynamic = "force-dynamic";    // évite le cache en build

/** POST /api/notify-auth
 * body: { type: "login" | "signup", userEmail: string }
 */
export async function POST(req: Request) {
  try {
    const { type, userEmail } = await req.json();

    const typeStr = String(type || "").trim();
    const emailTrim = String(userEmail || "").trim().toLowerCase();

    if (!typeStr || !emailTrim) {
      return NextResponse.json(
        { error: "Type et email requis" },
        { status: 400 }
      );
    }

    const actionText =
      typeStr === "login" ? "s'est connecté" : "a créé un compte";

    const subject =
      typeStr === "login"
        ? "Nouvelle connexion sur Files Coaching"
        : "Nouveau compte créé sur Files Coaching";

    // Envoi via l’API Resend avec fetch (même logique que send-reset)
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Files Coaching <no-reply@appli.files-coaching.com>",
        to: "sportifandpro@gmail.com",
        subject,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#111">${subject}</h2>
            <p>Bonjour,</p>
            <p>Un utilisateur ${actionText} sur <strong>Files Coaching</strong>.</p>
            <p style="margin:12px 0">
              <strong>Email :</strong> ${emailTrim}
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:18px 0"/>
            <p style="font-size:12px;color:#888">© ${new Date().getFullYear()} Files Coaching</p>
          </div>
        `.trim(),
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error("[notify-auth] Resend API error:", resp.status, txt);
      // Réponse simple (le front n’en a pas besoin de toute façon)
      return NextResponse.json(
        { ok: false, message: "Erreur lors de l’envoi de l’email." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("[notify-auth] fatal:", e);
    return NextResponse.json(
      { ok: false, message: "Erreur interne." },
      { status: 500 }
    );
  }
}

