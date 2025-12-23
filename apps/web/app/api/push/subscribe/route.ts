// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebPushSubscription = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const deviceId = body?.deviceId as string | undefined;
    const subscription = body?.subscription as WebPushSubscription | undefined;

    if (!deviceId || !subscription) {
      return NextResponse.json({ ok: false, error: "missing_deviceId_or_subscription" }, { status: 400 });
    }

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ ok: false, error: "missing_endpoint_or_keys" }, { status: 400 });
    }

    const userAgent =
      (body?.userAgent as string | undefined) ||
      (req.headers.get("user-agent") ?? undefined);

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId, // ⚠️ doit être un UUID string
          endpoint,
          p256dh,
          auth,
          device_id: deviceId,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("[push/subscribe] Supabase upsert failed", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[push/subscribe] Fatal error", e);
    return NextResponse.json({ ok: false, error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
