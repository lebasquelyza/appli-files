// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY_PREFIX = "push:sub:";

export async function POST(req: NextRequest) {
  if (!url || !token) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_upstash_env",
        hasUrl: !!url,
        hasToken: !!token,
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const deviceId = body?.deviceId;
  const subscription = body?.subscription;

  if (!deviceId || !subscription) {
    return NextResponse.json(
      { ok: false, error: "missing_deviceId_or_subscription" },
      { status: 400 }
    );
  }

  // stocke la souscription (string JSON) dans Upstash
  const r = await fetch(`${url}/set/${KEY_PREFIX}${deviceId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subscription),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: "upstash_write_failed", detail: txt },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
