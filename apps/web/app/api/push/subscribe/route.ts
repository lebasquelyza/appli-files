// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_PREFIX = "push:sub:";

function safeParseUrl(raw: string) {
  try {
    const u = new URL(raw);
    return { ok: true as const, url: u };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e) };
  }
}

type WebPushSubscription = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: NextRequest) {
  try {
    // -------- 1) Lecture env Upstash (logique inchangée) --------
    const rawUrl = (process.env.UPSTASH_REDIS_REST_URL ?? "").trim();
    const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();

    if (!rawUrl || !token) {
      console.error("[push/subscribe] Missing Upstash env", { hasUrl: !!rawUrl, hasToken: !!token });
      return NextResponse.json(
        { ok: false, error: "missing_upstash_env", hasUrl: !!rawUrl, hasToken: !!token },
        { status: 500 }
      );
    }

    const parsed = safeParseUrl(rawUrl);
    if (!parsed.ok) {
      console.error("[push/subscribe] Invalid UPSTASH_REDIS_REST_URL", {
        rawUrlPreview: rawUrl.slice(0, 60),
        error: parsed.error,
      });
      return NextResponse.json({ ok: false, error: "invalid_upstash_url", detail: parsed.error }, { status: 500 });
    }

    // -------- 2) Body --------
    const body = await req.json().catch(() => null);
    const deviceId = body?.deviceId as string | undefined;
    const subscription = body?.subscription as WebPushSubscription | undefined;

    if (!deviceId || !subscription) {
      return NextResponse.json({ ok: false, error: "missing_deviceId_or_subscription" }, { status: 400 });
    }

    // -------- 3) Écriture Upstash (logique inchangée) --------
    const upstashBase = parsed.url.toString().replace(/\/+$/, "");
    const key = `${KEY_PREFIX}${deviceId}`;
    const upstashUrl = `${upstashBase}/set/${encodeURIComponent(key)}`;

    let r: Response;
    try {
      r = await fetch(upstashUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });
    } catch (e: any) {
      console.error("[push/subscribe] fetch failed", {
        host: parsed.url.host,
        protocol: parsed.url.protocol,
        message: String(e?.message || e),
        cause: e?.cause ? String(e.cause) : undefined,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "upstash_fetch_failed",
          host: parsed.url.host,
          protocol: parsed.url.protocol,
          message: String(e?.message || e),
          cause: e?.cause ? String(e.cause) : undefined,
        },
        { status: 500 }
      );
    }

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("[push/subscribe] Upstash write failed", {
        status: r.status,
        host: parsed.url.host,
        detail: detail.slice(0, 300),
      });
      return NextResponse.json({ ok: false, error: "upstash_write_failed", status: r.status, detail }, { status: 500 });
    }

    // -------- 4) BONUS: Écriture DB Prisma (pour que le cron envoie) --------
    // ⚠️ On ne casse jamais l’activation: pas de 401, on tente juste si session dispo.
    try {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as any)?.id as string | undefined;

      const endpoint = subscription?.endpoint;
      const p256dh = subscription?.keys?.p256dh;
      const auth = subscription?.keys?.auth;

      if (userId && endpoint && p256dh && auth) {
        const userAgent = req.headers.get("user-agent") ?? undefined;

        await prisma.pushSubscription.upsert({
          where: { endpoint }, // endpoint est @unique dans ton schema
          update: { userId, p256dh, auth, userAgent },
          create: { userId, endpoint, p256dh, auth, userAgent },
        });
      } else {
        // pas de session ou subscription incomplète => on ne bloque pas
        if (!userId) console.warn("[push/subscribe] No session => DB not updated");
        if (userId && (!endpoint || !p256dh || !auth)) console.warn("[push/subscribe] Missing subscription keys => DB not updated");
      }
    } catch (e: any) {
      // on log mais on ne casse pas le subscribe
      console.error("[push/subscribe] DB write failed (ignored)", e?.message || e);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[push/subscribe] Fatal error", e);
    return NextResponse.json({ ok: false, error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
