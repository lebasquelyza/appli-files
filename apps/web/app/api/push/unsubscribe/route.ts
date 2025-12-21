// apps/web/app/api/push/unsubscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // On accepte plusieurs formes pour être rétro-compatible côté client :
  // - { endpoint: string }
  // - { subscription: { endpoint: string, ... } }
  const endpoint =
    (typeof body.endpoint === "string" && body.endpoint) ||
    (typeof body.subscription?.endpoint === "string" && body.subscription.endpoint) ||
    null;

  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "missing_endpoint" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      userId,
      endpoint,
    },
  });

  return NextResponse.json({ ok: true });
}
