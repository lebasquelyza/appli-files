// apps/web/app/signin/server-actions.ts
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Server Action appelée au moment du sign-in.
 * Elle enregistre l'email dans un cookie lisible côté serveur
 * pour que /dashboard/profile puisse charger les infos depuis le Sheet.
 */
export async function upsertOnSignIn(emailRaw: string) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (email) {
    cookies().set("app_email", email, {
      path: "/",
      // httpOnly volontairement false ici pour autoriser l'écriture côté client si besoin;
      // si tu préfères strict serveur, passe à true et pose le cookie côté client aussi.
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Invalide le cache de la page profil pour refléter l'email immédiatement
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
