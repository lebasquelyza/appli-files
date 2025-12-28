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
      httpOnly: true, // ✅ CRITIQUE pour iOS PWA
      sameSite: "lax",
      secure: true, // ✅ TOUJOURS true en prod (iOS l’exige)
      maxAge: 60 * 60 * 24 * 365, // 1 an
    });
  }

  revalidatePath("/dashboard/profile");
  return { ok: true };
}
