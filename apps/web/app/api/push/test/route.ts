import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubRow = { endpoint: string; p256dh: string; auth: string };

export async function POST(req: NextRequest) {
  try {
    // ✅ Auth: session OU secret (prod)
    const session = await getServerSession(authOptions);
    const hasSession = !!session; // ✅ ne dépend PAS de session.user.id

    const isProd = process.env.NODE_ENV === "production";
    if (isProd && !hasSession) {
      const secret = req.headers.get("x-push-test-secret") || req.nextUrl.searchParams.get("secret");
      if (!process.env.PUSH_TEST_SECRET || secret !== process.env.PUSH_TEST_SECRET) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }

    // ✅ Supabase admin
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ✅ VAPID
    const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!PUB || !PRIV) {
      return NextResponse.json({ ok: false, error: "missing_vapid_keys" }, { status: 500 });
    }

    // ✅ Récupère 1 subscription scope motivation (la plus récente)
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("scope", "motivation")
      .order("updated_at", { ascending: false })
      .limit(1)
      .returns<PushSubRow[]>();

    if (subsErr) {
      return NextResponse.json({ ok: false, error: "subs_query_failed", detail: subsErr.message }, { status: 500 });
    }
    if (!subs?.length) {
      return NextResponse.json({ ok: true, sent: 0, info: "no_subscriptions_for_scope_motivation" });
    }

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const payload = {
      title: "Files",
      body: "Notification de test ✅ (Motivation)",
      scope: "motivation",
      data: { url: "/dashboard/motivation", scope: "motivation" },
    };

    const s = subs[0];
    const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };

    try {
      await webpush.sendNotification(subscription as any, JSON.stringify(payload));
    } catch (e: any) {
      const status = e?.statusCode;
      if (status === 410 || status === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        return NextResponse.json({ ok: false, error: "subscription_gone_deleted", status });
      }
      return NextResponse.json(
        { ok: false, error: "send_failed", status, message: String(e?.message || e) },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, sent: 1 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
