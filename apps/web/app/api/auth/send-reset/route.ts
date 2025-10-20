import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

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

    // Supabase admin client (server-only)
    const supaAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ server-only
    );

    // 1) Vérifier que l’utilisateur existe (facultatif mais utile)
    const { data: users, error: listErr } = await supaAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      email: emailTrim,
    } as any); // typings pas encore publics sur ce filtre, d'où le 'as any'
    if (listErr) {
      console.error("[send-reset] listUsers error:", listErr);
      // on ne divulgue pas d'info, on continue pour ne pas leak l'existence du compte
    }
    const userExists = users?.users?.length ? true : false;

    // 2) Générer le lien de récupération (recovery) côté serveur
    const { data, error: genErr } = await supaAdmin.auth.admin.generateLink({
      type: "recovery",
      email: emailTrim,
      options: {
        // doit être autorisé dans Supabase → Auth → URL Configuration → Redirect URLs
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      },
    });
    if (genErr || !data?.properties?.action_link) {
      console.error("[send-reset] generateLink error:", genErr);
      // Ne jamais révéler si le compte existe ou pas
      return NextResponse.json(
        { ok: true, message: "Si un compte existe, un email a été envoyé." },
        { status: 200 }
      );
    }

    const link = data.properties.action_link;

    // 3) Envoyer l'email via Resend
    const subject = "Réinitialisation de votre mot de passe";
    const html = `
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
      </div>`.trim();

    await resend.emails.send({
      from: "Files Coaching <no-reply@appli.files-coaching.com>",
      to: emailTrim,
      subject,
      html,
    });

    // Réponse “neutre” pour ne pas leak la validité de l’email
    return NextResponse.json(
      { ok: true, message: "Si un compte existe, un email a été envoyé." },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[send-reset] fatal:", e);
    // Réponse neutre (pas d’info sur existence du compte)
    return NextResponse.json(
      { ok: true, message: "Si un compte existe, un email a été envoyé." },
      { status: 200 }
    );
  }
}
