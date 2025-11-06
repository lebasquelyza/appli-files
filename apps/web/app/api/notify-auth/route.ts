import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS via STARTTLS
  auth: {
    user: "sportifandpro@gmail.com",
    // ⚠️ mets ici TON mot de passe d'application Gmail
    pass: "TON_MOT_DE_PASSE_APPLICATION_GMAIL",
  },
});

export async function POST(req: NextRequest) {
  try {
    const { type, userEmail } = await req.json();

    if (!type || !userEmail) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const actionText =
      type === "login" ? "s'est connecté" : "a créé un compte";

    await transporter.sendMail({
      from: '"Files Coaching" <sportifandpro@gmail.com>',
      to: "sportifandpro@gmail.com",
      subject:
        type === "login"
          ? "Nouvelle connexion sur Files Coaching"
          : "Nouveau compte créé sur Files Coaching",
      text: `Un utilisateur ${actionText} : ${userEmail}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("notify-auth error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
