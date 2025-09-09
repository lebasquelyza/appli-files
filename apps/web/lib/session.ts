'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function updateProfile(formData: FormData) {
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName  = String(formData.get('lastName')  || '').trim();
  const plan      = String(formData.get('plan')      || 'BASIC');

  if (!firstName || !lastName) {
    return { ok: false, error: 'Prénom et nom sont requis.' };
  }
  if (!['BASIC','PLUS','PREMIUM'].includes(plan)) {
    return { ok: false, error: 'Plan invalide.' };
  }

  const jar = cookies();
  const currentRaw = jar.get('app_session')?.value ?? '{}';
  let s: any = {};
  try { s = JSON.parse(currentRaw); } catch {}
  s.firstName = firstName;
  s.lastName = lastName;
  s.plan = plan;

  jar.set('app_session', JSON.stringify(s), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  // Réaffiche la page avec les nouvelles données
  revalidatePath('/dashboard/profile');
  return { ok: true };
}

// ⚠️ Comme le fichier est en 'use server', cette fonction doit être async.
export async function getSession() {
  const raw = cookies().get('app_session')?.value ?? '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}
