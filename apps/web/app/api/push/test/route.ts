// apps/web/app/api/push/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-push-test-secret") || req.nextUrl.searchParams.get("secret");
    if (!process.env.PUSH_TEST_SECRET || secret !== process.env.PUSH_TEST_SECRET) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!PUB || !PRIV) {
      return NextResponse.json({ ok: false, error: "missing_vapid_keys" }, { status: 500 });
    }

    const userId = req.nextUrl.searchParams.get("user_id");

    let q = supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .order("updated_at", { ascending: false })
      .limit(1);

    // ✅ FIX ICI
    if (userId) q = q.eq("app_user_id", userId);

    const { data: subs, error } = await q.returns<PushSubRow[]>();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const payload = JSON.stringify({
      title: "Files",
      body: "Notification de test ✅",
      data: { url: "/dashboard/motivation" },
    });

    const s = subs[0];

    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        } as any,
        payload
      );
    } catch (e: any) {
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
      return NextResponse.json({ ok: false, error: "send_failed", message: String(e?.message || e) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sent: 1 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
