import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const URL  = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN= process.env.UPSTASH_REDIS_REST_TOKEN!;
const PREFS_KEY = "push:prefs:";
const INDEX_KEY = "push:prefs:index"; // set des deviceId

export async function POST(req: NextRequest) {
  try {
    const { deviceId, time, days, tz } = await req.json();
    if (!deviceId || !time || !Array.isArray(days) || !tz) {
      return NextResponse.json({ ok:false, error:"invalid_payload" }, { status:400 });
    }

    const payload = JSON.stringify({ time, days, tz }); // time: "HH:mm", days: number[], tz: IANA
    // SET
    const r1 = await fetch(`${URL}/set/${PREFS_KEY}${deviceId}/${encodeURIComponent(payload)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!r1.ok) return NextResponse.json({ ok:false, error:"kv_set_failed" }, { status:500 });

    // INDEX (SADD)
    const r2 = await fetch(`${URL}/sadd/${INDEX_KEY}/${deviceId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!r2.ok) return NextResponse.json({ ok:false, error:"kv_index_failed" }, { status:500 });

    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:500 });
  }
}
