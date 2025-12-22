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
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "unauthorized_no_userId" }, { status: 401 });
    }

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

    // (Optionnel mais recommandé) s'assurer que l'utilisateur existe dans AppUser
    // Ton callback session le fait déjà, mais là au moins on sécurise.
    await prisma.appUser.upsert({
      where: { id: userId },
      update: {
        email: session?.user?.email ?? undefined,
        name: session?.user?.name ?? undefined,
        image: (session?.user as any)?.image ?? undefined,
      },
      create: {
        id: userId,
        email: session?.user?.email ?? undefined,
        name: session?.user?.name ?? undefined,
        image: (session?.user as any)?.image ?? undefined,
      },
    });

    // ✅ Stockage subscription pour le cron (Prisma)
    await prisma.pushSubscription.upsert({
      where: { endpoint }, // endpoint doit être @unique
      update: { userId, p256dh, auth },
      create: { userId, endpoint, p256dh, auth },
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
