import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebPushSubscription = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE url or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const appUserId = (session?.user as any)?.id as string | undefined;

    const email = (cookies().get("app_email")?.value || "").trim().toLowerCase() || undefined;

    if (!appUserId && !email) {
      return NextResponse.json(
        { ok: false, error: "unauthorized_no_app_user_id" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const deviceId = (body?.deviceId as string | undefined)?.trim();
    const subscription = body?.subscription as WebPushSubscription | undefined;

    if (!deviceId || !subscription) {
      return NextResponse.json({ ok: false, error: "missing_deviceId_or_subscription" }, { status: 400 });
    }

    const endpoint = subscription?.endpoint?.trim();
    const p256dh = subscription?.keys?.p256dh?.trim();
    const auth = subscription?.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ ok: false, error: "missing_endpoint_or_keys" }, { status: 400 });
    }

    const userAgent =
      (body?.userAgent as string | undefined) || req.headers.get("user-agent") || undefined;

    const supabase = getSupabaseAdmin();

    // ✅ 1) NextAuth user => table existante (avec user_id/app_user_id NOT NULL)
    if (appUserId) {
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            app_user_id: appUserId, // ou user_id si ta table utilise user_id
            device_id: deviceId,
            endpoint,
            p256dh,
            auth,
            user_agent: userAgent,
          },
          { onConflict: "app_user_id,device_id" }
        );

      if (error) {
        console.error("[push/subscribe] Supabase upsert failed", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // ✅ 2) Pas de NextAuth => table email (sans user_id NOT NULL)
    const { error } = await supabase
      .from("push_subscriptions_email")
      .upsert(
        {
          email,
          device_id: deviceId,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,device_id" }
      );

    if (error) {
      console.error("[push/subscribe] Supabase upsert failed (email table)", error);
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
