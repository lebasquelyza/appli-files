import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const url = process.env.UPSTASH_REDIS_REST_URL!;
const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
const KEY_PREFIX = "push:sub:";

export async function POST(req: NextRequest) {
  try {
    const { deviceId, payload } = await req.json();
    if (!deviceId) {
      return NextResponse.json({ ok:false, error:"missing_device" }, { status:400 });
    }

    // 1) Récup souscription
    const r = await fetch(`${url}/get/${KEY_PREFIX}${deviceId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ ok:false, error:"kv_get_failed" }, { status:500 });
    }
    const { result } = await r.json();
    if (!result) {
      return NextResponse.json({ ok:false, error:"not_found" }, { status:404 });
    }
    const subscription = JSON.parse(result);

    // 2) web-push (import dynamique CJS)
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      process.env.VAPID_PUBLIC_KEY!,     // == NEXT_PUBLIC_VAPID_PUBLIC_KEY côté client
      process.env.VAPID_PRIVATE_KEY!
    );

    const body = JSON.stringify(
      payload ?? { title:"CoachFit", body:"Test 💪", url:"/dashboard" }
    );

    await webpush.sendNotification(subscription, body);
    return NextResponse.json({ ok:true });

  } catch (err: any) {
    // Gestion fine des erreurs web-push (expiration = 410)
    const msg = String(err?.message || err);
    const statusCode = Number(err?.statusCode || err?.status || 500);

    if (statusCode === 410) {
      // abonnement expiré : on le supprime pour éviter les 500 suivants
      try {
        await fetch(`${url}/del/${KEY_PREFIX}${(await req.json()).deviceId}`, {
          headers: { Authorization: `Bearer ${token}` },
          method: "POST",
        });
      } catch {}
      return NextResponse.json({ ok:false, error:"subscription_gone" }, { status:410 });
    }

    console.error("[push/test] error:", err);
    return NextResponse.json({ ok:false, error: msg }, { status:500 });
  }
}
