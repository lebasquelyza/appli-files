// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebPushSubscription = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: NextRequest) {
  const prisma = new PrismaClient();

  try {
    // ✅ Session NextAuth
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;

    if (!email) {
      return NextResponse.json({ ok: false, error: "unauthorized_no_session" }, { status: 401 });
    }

    // ✅ Retrouver le userId via email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized_user_not_found" }, { status: 401 });
    }

    // ✅ Body
    const body = await req.json().catch(() => null);
    const subscription = body?.subscription as WebPushSubscription | undefined;

    if (!subscription?.endpoint) {
      return NextResponse.json({ ok: false, error: "missing_subscription" }, { status: 400 });
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    if (!p256dh || !auth) {
      return NextResponse.json({ ok: false, error: "missing_keys" }, { status: 400 });
    }

    // ✅ Upsert (endpoint unique)
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh,
        auth,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[push/subscribe] error", e);
    return NextResponse.json(
      { ok: false, error: "subscribe_failed", message: String(e?.message || e) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
