// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// ⚠️ adapte ce chemin selon ton projet NextAuth
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // <-- change si nécessaire

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebPushSubscription = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: NextRequest) {
  const prisma = new PrismaClient();

  try {
    // 1) User connecté
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // 2) Body
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

    // 3) Upsert par endpoint (évite les doublons)
    //    - si endpoint déjà connu, on met à jour userId + keys
    //    - sinon on crée
    await prisma.pushSubscription.upsert({
      where: { endpoint }, // endpoint doit être @unique dans Prisma
      update: {
        userId,
        p256dh,
        auth,
        updatedAt: new Date(),
      },
      create: {
        userId,
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
