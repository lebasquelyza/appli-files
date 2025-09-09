'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function updateProfile(formData: FormData): Promise<void> {
  // Lire l'état courant pour préserver ce qui n'est pas posté
  const jar = cookies();
  const currentRaw = jar.get('app_session')?.value ?? '{}';
  let s: any = {};
  try { s = JSON.parse(currentRaw); } catch {}

  const firstName = String(formData.get('firstName') ?? s.firstName ?? '').trim();
  const lastName  = String(formData.get('lastName')  ?? s.lastName  ?? '').trim();
  const planIn    = formData.get('plan');
  const plan      = (planIn ? String(planIn) : s.plan) ?? 'BASIC';

  // Validation minimale
  if (!firstName || !lastName) {
    redirect('/dashboard/profile?error=' + encodeURIComponent('Prénom et nom sont requis.'));
  }
  if (!['BASIC','PLUS','PREMIUM'].includes(plan)) {
    redirect('/dashboard/profile?error=' + encodeURIComponent('Plan invalide.'));
  }

  // Persistance (exemple via cookie — remplace par ta DB si besoin)
  s.firstName = firstName;
  s.lastName  = lastName;
  s.plan      = plan;
  // s.nextChargeAt / s.expiresAt : laisse intacts si tu les gères côté billing

  jar.set('app_session', JSON.stringify(s), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  // Revalider & rediriger avec succès
  revalidatePath('/dashboard/profile');
  redirect('/dashboard/profile?ok=1');
}

export async function getSession() {
  const raw = cookies().get('app_session')?.value ?? '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}
