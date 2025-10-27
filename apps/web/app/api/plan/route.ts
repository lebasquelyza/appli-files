// apps/web/app/api/plan/route.ts
import { NextResponse } from "next/server";
import { planProgrammeFromProfile } from "@/lib/coach/beton";

// --- helpers ---
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function extractDaysList(text?: string | null): string[] {
  if (!text) return [];
  const s = String(text).toLowerCase();
  const out: string[] = [];
  const push = (d: string) => { if (!out.includes(d)) out.push(d); };

  // week-end = samedi + dimanche
  if (/week\s*-?\s*end|weekend/.test(s)) { push("samedi"); push("dimanche"); }

  for (const d of ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]) {
    if (new RegExp(`\\b${d}\\b`, "i").test(s)) push(d);
  }
  return out;
}
// chiffre strict 1..6, formes: "5", "5j", "5 x", "5 fois", "5 j/sem", "5 jours/semaine"
function inferNumeric1to6(text?: string | null): number | undefined {
  if (!text) return undefined;
  const s = String(text).toLowerCase();
  const m = s.match(/\b([1-6])\s*(x|fois|j|jr|jrs|jour|jours)?(\s*(par|\/)\s*(semaine|sem))?\b/);
  if (m) return clamp(parseInt(m[1], 10), 1, 6);
  return undefined;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json(); // { profile, maxSessions? }
    const profile = payload?.profile || {};
    // 1) Prend d'abord les jours nommés
    const days = extractDaysList(profile?.availabilityText);
    // 2) Sinon, prend un chiffre 1..6 s'il est présent
    const numeric = inferNumeric1to6(profile?.availabilityText);
    // 3) Fallback éventuel sur ce que le client envoie, sinon 3
    const clientMax = Number(payload?.maxSessions) || undefined;

    const decided = days.length || numeric || clientMax || 3;
    const maxSessions = clamp(decided, 1, 6);

    const { sessions } = planProgrammeFromProfile(profile, {
      maxSessions,
      preset: "example_v1", // on garde le programme figé
    } as any);

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
