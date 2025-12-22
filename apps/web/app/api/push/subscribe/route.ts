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

    // ✅ Identité robuste: priorité à user.id, fallback sur email
    const identity =
      ((session?.user as any)?.id as string | undefined) ||
      (session?.user?.email as string | undefined);

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
      return NextResponse.json({ ok: false, error: "missing_keys" }, { status: 400 });
    }

    // (Optionnel) garder l'annuaire AppUser à jour si identity = spotifyId
    // Si identity = email, on ne touche pas AppUser (car id attendu = spotifyId)
    if ((session?.user as any)?.id) {
      const userId = (session?.user as any)?.id as string;
      await prisma.appUser
        .upsert({
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
        })
        .catch(() => {
          // on évite de faire échouer l'inscription push si AppUser pose souci
        });
    }

    // ✅ Stockage dans Prisma pour que push-cron.js puisse envoyer
    // NOTE: "userId" ici = identity (spotifyId OU email)
    await prisma.pushSubscription.upsert({
      where: { endpoint }, // endpoint doit être @unique dans Prisma
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
