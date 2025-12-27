import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  // ✅ cookie lisible côté serveur (next/headers)
  res.cookies.set("app_email", email, {
    httpOnly: false,       // tu veux le lire côté serveur ET potentiellement côté client
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 an
  });

  return res;
}
