import { NextRequest, NextResponse } from "next/server";

const url  = process.env.UPSTASH_REDIS_REST_URL!;
const token= process.env.UPSTASH_REDIS_REST_TOKEN!;
const KEY_PREFIX = "push:sub:";

export async function POST(req: NextRequest) {
  const { deviceId, subscription } = await req.json();
  if (!deviceId || !subscription) {
    return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  }

  // stocke la souscription (string)
  const r = await fetch(`${url}/set/${KEY_PREFIX}${deviceId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  if (!r.ok) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
