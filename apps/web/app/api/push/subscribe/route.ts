// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getToken } from "next-auth/jwt";
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
    // ✅ 1) On essaie la session (parfois null en prod)
    const session = await getServerSession(authOptions);
    let identity =
      ((session?.user as any)?.id as string | undefined) ||
      (session?.user?.email as string | undefined);

    // ✅ 2) Fallback ultra robuste: lecture du JWT NextAuth directement
    // (c'est ça qui règle 99% des 401 "no_userId" sur Netlify/iOS)
    if (!identity) {
      const token = await getToken({
        req: req as any,
        secret: process.env.NEXTAUTH_SECRET,
      });

      identity =
        (token?.sub as string | undefined) ||
        (token?.email as string | undefined);
    }

    if (!identity) {
      return NextResponse.json(
        { ok: false, error: "unauthorized_no_identity" },
        { status: 401 }
      );
    }

    // ✅ Body
    const body = await req.json().catch(() => null);
    const subscription = body?.subscription as WebPushSubscription | undefined;

    if (!subscription?.endpoint) {
      return NextResponse.json(
        { ok: false, error: "missing_subscription" },
        { status: 400 }
      );
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    if (!p256dh || !auth) {
      return NextResponse.json(
        { ok: false, error: "missing_keys" },
        { status: 400 }
      );
    }

    // ✅ Stockage Prisma pour le cron
    await prisma.pushSubscription.upsert({
      where: { endpoint }, // endpoint doit être @unique
      update: { userId: identity, p256dh, auth },
      create: { userId: identity, endpoint, p256dh, auth },
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
