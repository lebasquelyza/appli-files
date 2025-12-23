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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE url or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // UUID Supabase attendu (stocké dans la session NextAuth)
    const supaUserId = (session?.user as any)?.supabaseUserId as string | undefined;
    if (!supaUserId) {
      return NextResponse.json(
        { ok: false, error: "unauthorized_no_supabase_user_id" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const deviceId = body?.deviceId as string | undefined;
    const subscription = body?.subscription as WebPushSubscription | undefined;

    if (!deviceId || !subscription) {
      return NextResponse.json(
        { ok: false, error: "missing_deviceId_or_subscription" },
        { status: 400 }
      );
    }

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { ok: false, error: "missing_endpoint_or_keys" },
        { status: 400 }
      );
    }

    const userAgent =
      (body?.userAgent as string | undefined) || req.headers.get("user-agent") || undefined;

    const supabase = getSupabaseAdmin();

    // ✅ Upsert par (user_id, device_id) pour éviter les doublons quand l'endpoint change
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: supaUserId,
          endpoint,
          p256dh,
          auth,
          device_id: deviceId,
          user_agent: userAgent,
        },
        { onConflict: "user_id,device_id" }
      );

    if (error) {
      console.error("[push/subscribe] Supabase upsert failed", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[push/subscribe] Fatal error", e);
    return NextResponse.json(
      { ok: false, error: "fatal", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

