import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-push-test-secret") || req.nextUrl.searchParams.get("secret");
    if (!process.env.PUSH_TEST_SECRET || secret !== process.env.PUSH_TEST_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 500 });
    }

    const PUB = process.env.VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!PUB || !PRIV) {
      return NextResponse.json({ ok: false, error: "missing_vapid_keys" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Prend la subscription la plus récente
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (subsErr) {
      return NextResponse.json({ ok: false, error: "subs_query_failed", detail: subsErr.message }, { status: 500 });
    }
    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, info: "no_subscriptions_in_db" });
    }

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const payload = {
      title: "Files",
      body: "Notification de test ✅ (Supabase)",
      data: { url: "/dashboard/motivation" },
    };

    const s = subs[0];
    const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };

    await webpush.sendNotification(subscription as any, JSON.stringify(payload));

    return NextResponse.json({ ok: true, sent: 1 });
  } catch (e: any) {
    console.error("[push/test] fatal", e);
    return NextResponse.json({ ok: false, error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
