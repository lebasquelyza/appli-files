// apps/web/app/api/push/test/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE url or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST() {
  try {
    // ✅ NEW: fallback env vars
    const PUB = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY || process.env.NEXT_PUBLIC_VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!PUB || !PRIV) return NextResponse.json({ ok: false, error: "missing_vapid_keys" }, { status: 500 });

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const supabase = getSupabaseAdmin();

    const { data: subs, error } = await supabase
      .from("push_subscriptions_device")
      .select("endpoint, p256dh, auth")
      .eq("scope", "motivation");

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!subs?.length) return NextResponse.json({ ok: true, sent: 0, note: "no subscriptions" });

    let sent = 0;
    let failed = 0;

    // ✅ NEW: tag anti-doublons
    const tag = `motivation|test|${Date.now()}`;

    for (const s of subs) {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: "Files Le Coach",
            body: "Test push serveur ✅",
            scope: "motivation", // ✅ CRITIQUE (sinon SW filtre)
            tag, // ✅ NEW
            data: { url: "/dashboard/motivation", scope: "motivation", tag }, // ✅ NEW
          })
        );
        sent++;
      } catch (e: any) {
        failed++;
        const code = Number(e?.statusCode || e?.status || 0);
        // endpoints morts => purge
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions_device").delete().eq("endpoint", s.endpoint);
        }
      }
    }

    return NextResponse.json({ ok: true, sent, failed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
