// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { endpoint, keys, scope, deviceId, userAgent } = body || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth || !deviceId) {
      return NextResponse.json(
        { error: "missing_fields" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("push_subscriptions_device")
      .upsert(
        {
          device_id: deviceId,
          scope: scope || "motivation",
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent || null,
        },
        { onConflict: "device_id,scope" }
      );

    if (error) {
      console.error("[push-subscribe] supabase error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[push-subscribe] fatal", e);
    return NextResponse.json(
      { error: "fatal", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
