// apps/web/app/api/push/test/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const url = process.env.UPSTASH_REDIS_REST_URL!;
const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
const KEY_PREFIX = "push:sub:";

export async function POST(req: NextRequest) {
  try {
    // --- Params ---
    const { deviceId, payload } = await req.json();
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "missing_device" }, { status: 400 });
    }

    // --- VAPID env checks ---
    const VAPID_PUB = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!VAPID_PUB || !VAPID_PRIV) {
      return NextResponse.json({ ok: false, error: "missing_vapid_keys" }, { status: 500 });
    }

    // --- Get subscription from Upstash ---
    const r = await fetch(`${url}/get/${KEY_PREFIX}${deviceId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "kv_get_failed" }, { status: 500 });
    }
    const { result } = await r.json();
    if (!result) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const subscription = JSON.parse(result);

    // --- web-push (dynamic import to avoid edge bundling) ---
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(VAPID_SUBJ, VAPID_PUB, VAPID_PRIV);

    // --- Payload (default: Files Coaching) ---
    const body = JSON.stringify(
      payload ?? {
        title: "Files Coaching",
        body: "Test push : prêt·e pour 10 min ? 💪",
        url: "/dashboard",
      }
    );

    await webpush.sendNotification(subscription, body);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const statusCode = Number(err?.statusCode || err?.status || 500);
    const msg = String(err?.message || err);

    // Subscription expired/gone — clean it up to avoid repeated failures
    if (statusCode === 410) {
      const body = await req
        .json()
        .catch(() => ({ deviceId: undefined })) as { deviceId?: string };
      const id = body?.deviceId;
      if (id) {
        try {
          await fetch(`${url}/del/${KEY_PREFIX}${id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {}
      }
      return NextResponse.json({ ok: false, error: "subscription_gone" }, { status: 410 });
    }

    console.error("[/api/push/test] error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
