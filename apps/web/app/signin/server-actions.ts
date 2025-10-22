// apps/web/app/signin/server-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { upsertUserProfileByEmail } from "@/lib/coach/ai";

/**
 * Server Action appelée au moment du sign-in.
 * - Valide l'email
 * - Upsert le profil en base (et pose le cookie "app_email" via la fonction importée)
 * - Revalide la page Profil pour afficher l'email immédiatement
 */
export async function upsertOnSignIn(
  email: string,
  extra?: { prenom?: string }
) {
  const e = String(email || "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new Error("Adresse e-mail invalide");
  }

  const profile = await upsertUserProfileByEmail(e, { prenom: extra?.prenom });

  // Si ton profil est sous /dashboard/profile, on revalide cette route
  revalidatePath("/dashboard/profile");

  // Tu peux retourner ce qui est utile au client
  return {
    ok: true,
    profile,
  };
}
