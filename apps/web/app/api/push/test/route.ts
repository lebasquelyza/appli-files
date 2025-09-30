import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const url = process.env.UPSTASH_REDIS_REST_URL!;
const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
const KEY_PREFIX = "push:sub:";

export async function POST(req: NextRequest) {
  const { deviceId, payload } = await req.json();
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  }

  // Récupère la souscription depuis Upstash
  const r = await fetch(`${url}/get/${KEY_PREFIX}${deviceId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ ok: false }, { status: 500 });

  const { result } = await r.json();
  if (!result) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  try {
    // Import dynamique (CJS) pour éviter le bundling côté edge
    const webpush = (await import("web-push")).default;

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    const subscription = JSON.parse(result);
    const body = JSON.stringify(
      payload ?? {
        title: "CoachFit",
        body: "Rappel motivation : on bouge ? 💪",
        url: "/dashboard",
      }
    );

    await webpush.sendNotification(subscription, body);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

