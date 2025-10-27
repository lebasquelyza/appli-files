// apps/web/app/api/plan/route.ts
import { NextResponse } from "next/server";
import { planProgrammeFromProfile } from "@/lib/coach/beton";

export async function POST(req: Request) {
  const payload = await req.json();       // { profile, maxSessions, ... }
  const profile = payload?.profile || {};
  const maxSessions = payload?.maxSessions;

  const { sessions } = planProgrammeFromProfile(profile, {
    maxSessions,
    preset: "example_v1",                 // 👈 Forçage du programme figé
  });

  return NextResponse.json({ sessions });
}
