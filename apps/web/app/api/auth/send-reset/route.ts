// apps/web/app/api/auth/send-reset/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";            // force le runtime Node
export const dynamic = "force-dynamic";     // évite le caching en build

/** POST /api/auth/send-reset
 * body: { email: string }
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const emailTrim = String(email || "").trim().toLowerCase();
    if (!emailTrim) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    // Supabase admin (server-only)
    const supaAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ server only
    );

    // Génère le lien de réinitialisation
    const { data, error: genErr } = await supaAdmin.auth.admin.generateLink({
      type: "recovery",
      email: emailTrim,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      },
    });
    if (genErr || !data?.properties?.action_link) {
      console.error("[send-reset] generateLink error:", genErr);
      return NextResponse.json(
        { ok: true, message: "Si un compte existe, un e-mail a été envoyé." },
        { status: 200 }
      );
    }
    const link = data.properties.action_link;

    // Envoi via l’API Resend avec fetch (pas besoin du SDK)
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Files Coaching <no-reply@appli.files-coaching.com>",
        to: emailTrim,
        subject: "Réinitialisation de votre mot de passe",
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#111">Réinitialisation de mot de passe</h2>
            <p>Bonjour,</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe pour <strong>Files Coaching</strong>.</p>
            <p style="margin:22px 0">
              <a href="${link}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
                Réinitialiser mon mot de passe
              </a>
            </p>
            <p style="font-size:13px;color:#555">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:18px 0"/>
            <p style="font-size:12px;color:#888">© ${new Date().getFullYear()} Files Coaching</p>
          </div>
        `.trim(),
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error("[send-reset] Resend API error:", resp.status, txt);
      // Réponse neutre (ne pas leak si l'email existe)
      return NextResponse.json(
        { ok: true, message: "Si un compte existe, un e-mail a été envoyé." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, message: "Si un compte existe, un e-mail a été envoyé." },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[send-reset] fatal:", e);
    return NextResponse.json(
      { ok: true, message: "Si un compte existe, un e-mail a été envoyé." },
      { status: 200 }
    );
  }
}

