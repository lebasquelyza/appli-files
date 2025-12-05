import { NextRequest, NextResponse } from "next/server";

const url  = process.env.UPSTASH_REDIS_REST_URL!;
const token= process.env.UPSTASH_REDIS_REST_TOKEN!;
const KEY_PREFIX = "push:sub:";

export async function POST(req: NextRequest) {
  const { deviceId } = await req.json();
  if (!deviceId) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

  const r = await fetch(`${url}/del/${KEY_PREFIX}${deviceId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
