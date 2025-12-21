// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_PREFIX = "push:sub:";

export async function POST(req: NextRequest) {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.error("[push/subscribe] Missing Upstash env", {
        hasUrl: !!url,
        hasToken: !!token,
      });

      return NextResponse.json(
        { ok: false, error: "missing_upstash_env", hasUrl: !!url, hasToken: !!token },
        { status: 500 }
      );
    }

    const body = await req.json().catch((e) => {
      console.error("[push/subscribe] Invalid JSON body", e);
      return null;
    });

    const deviceId = body?.deviceId as string | undefined;
    const subscription = body?.subscription;

    if (!deviceId || !subscription) {
      return NextResponse.json(
        { ok: false, error: "missing_deviceId_or_subscription" },
        { status: 400 }
      );
    }

    const upstashUrl = `${url}/set/${KEY_PREFIX}${encodeURIComponent(deviceId)}`;

    const r = await fetch(upstashUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("[push/subscribe] Upstash write failed", {
        status: r.status,
        detail: detail?.slice?.(0, 500),
      });

      return NextResponse.json(
        { ok: false, error: "upstash_write_failed", status: r.status, detail },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // ✅ plus jamais de "empty body"
    console.error("[push/subscribe] Fatal error", e);
    return NextResponse.json(
      { ok: false, error: "fatal", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

