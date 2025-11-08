import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";           // même logique que send-reset
export const dynamic = "force-dynamic";    // évite le cache en build

// Client Supabase "admin" (service_role) côté serveur
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

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

    const isLogin = typeStr === "login";
    const isSignup = typeStr === "signup";

    const actionText = isLogin
      ? "s'est connecté"
      : isSignup
      ? "a créé un compte"
      : `a effectué une action : ${typeStr}`;

    const subject = isLogin
      ? "Nouvelle connexion sur Files Coaching"
      : isSignup
      ? "Nouveau compte créé sur Files Coaching"
      : `Nouvel événement ${typeStr} sur Files Coaching`;

    // Nom d'événement pour la table auth_events
    const eventName = isLogin
      ? "LOGIN"
      : isSignup
      ? "SIGN_UP"
      : typeStr.toUpperCase();

    // 🔎 1) Vérif rapide des variables d'env (mais sans les afficher)
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[notify-auth] SUPABASE env vars manquantes");
      return NextResponse.json(
        { error: "Supabase env vars missing" },
        { status: 500 }
      );
    }

    // 🔎 2) On enregistre l'événement dans public.auth_events
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("auth_events")
      .insert({
        event_name: eventName,
        email: emailTrim,
        metadata: {
          source: "notify-auth",
          raw_type: typeStr,
        },
      })
      .select("id, event_name, email, created_at")
      .single();

    if (insertError) {
      console.error("[notify-auth] Supabase insert error:", insertError);
      return NextResponse.json(
        { error: "DB insert error", details: insertError.message },
        { status: 500 }
      );
    }

    // 3) On continue à envoyer l'email via Resend (comme avant)
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!}`,
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
      return NextResponse.json(
        { ok: false, message: "Erreur lors de l’envoi de l’email." },
        { status: 500 }
      );
    }

    // 🔎 On renvoie aussi ce qui a été inséré côté DB pour debug
    return NextResponse.json(
      { ok: true, inserted: insertData },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[notify-auth] fatal:", e);
    return NextResponse.json(
      { ok: false, message: "Erreur interne." },
      { status: 500 }
    );
  }
}
