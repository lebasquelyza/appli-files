// apps/web/lib/session.ts
'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

// ⚠️ Exemple minimal : on stocke dans un cookie "app_session".
// Remplace par ton vrai DB/update si tu as Prisma/NextAuth.

export async function updateProfile(formData: FormData) {
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName  = String(formData.get('lastName')  || '').trim();
  const plan      = String(formData.get('plan')      || 'BASIC');

  // petite validation
  if (!firstName || !lastName) {
    return { ok: false, error: 'Prénom et nom sont requis.' };
  }
  if (!['BASIC','PLUS','PREMIUM'].includes(plan)) {
    return { ok: false, error: 'Plan invalide.' };
  }

  // --- PERSISTENCE (au choix) ---

  // A) Cookie (démo / sans DB)
  const jar = cookies();
  const currentRaw = jar.get('app_session')?.value ?? '{}';
  let s: any = {};
  try { s = JSON.parse(currentRaw); } catch {}
  s.firstName = firstName;
  s.lastName = lastName;
  s.plan = plan;
  // Conserve tes champs d’abonnement si tu les as déjà:
  // s.nextChargeAt, s.expiresAt, etc.
  jar.set('app_session', JSON.stringify(s), { httpOnly: true, sameSite: 'lax', path: '/' });

  // B) (optionnel) Prisma + NextAuth
  // const { user } = await auth();
  // if (user?.id) {
  //   await db.user.update({
  //     where: { id: user.id },
  //     data: { firstName, lastName, plan }
  //   });
  // }

  // Revalide la page pour relire la session/DB
  revalidatePath('/dashboard/profile');
  return { ok: true };
}

// Si besoin d’un getSession() minimal basé cookie :
export function getSession() {
  const raw = cookies().get('app_session')?.value ?? '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}
