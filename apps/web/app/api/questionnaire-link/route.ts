// apps/web/app/api/questionnaire-link/route.ts
// Redirige vers le questionnaire protégé avec un token signé (HMAC SHA-256).
// Conserve les paramètres de pré-remplissage (email, prenom).

import crypto from "node:crypto";

export const runtime = "nodejs"; // garantit l'accès à node:crypto en App Router

function b64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildToken(secret: string, payload: Record<string, any>) {
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(payloadB64, "utf8").digest();
  const sigB64 = b64url(sig);
  return `${payloadB64}.${sigB64}`;
}

export async function GET(req: Request) {
  try {
    const secret = process.env.FC_SHARED_SECRET;
    if (!secret) {
      return new Response("FC_SHARED_SECRET manquante côté appli", { status: 500 });
    }

    // Domaine du questionnaire (configurable via env si besoin)
    const base =
      process.env.FILES_COACHING_QUESTIONNAIRE_BASE ||
      "https://questionnaire.files-coaching.com";

    // On récupère les params de pré-remplissage éventuels
    const url = new URL(req.url);
    const email = url.searchParams.get("email") || "";
    const prenom = url.searchParams.get("prenom") || "";

    // Token signé avec TTL et contrôle d'audience + source (profil)
    const payload = {
      exp: Date.now() + 15 * 60 * 1000, // 15 minutes
      aud: "questionnaire",
      src: "https://appli.files-coaching.com/dashboard/profile",
    };
    const token = buildToken(secret, payload);

    // On re-propage email/prenom au questionnaire pour pré-remplir
    const forward = new URLSearchParams();
    if (email) forward.set("email", email);
    if (prenom) forward.set("prenom", prenom);

    const finalUrl =
      `${base}?t=${encodeURIComponent(token)}` +
      (forward.toString() ? `&${forward.toString()}` : "");

    return Response.redirect(finalUrl, 302);
  } catch (e: any) {
    return new Response(`Erreur génération lien questionnaire: ${e?.message || e}`, {
      status: 500,
    });
  }
}
