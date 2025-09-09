'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function updateProfile(formData: FormData): Promise<void> {
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName  = String(formData.get('lastName')  || '').trim();
  const plan      = String(formData.get('plan')      || 'BASIC');

  // validations simples (tu peux lever une erreur si besoin)
  if (!firstName || !lastName) {
    // Option: throw new Error('Prénom et nom requis');
    // Ou juste ne rien faire.
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

  // Recharger la page avec les nouvelles infos
  revalidatePath('/dashboard/profile');
}

export async function getSession() {
  const raw = cookies().get('app_session')?.value ?? '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}
