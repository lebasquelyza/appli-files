// apps/web/app/api/push/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // pas nécessaire pour ce endpoint test
      },
      remove() {
        // pas nécessaire pour ce endpoint test
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const PUB = process.env.VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

    if (!PUB || !PRIV) {
      return NextResponse.json({ ok: false, error: "missing_vapid_keys" }, { status: 500 });
    }

    const supabase = getSupabaseServer();

    // 1) user connecté (Supabase Auth)
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      return NextResponse.json({ ok: false, error: "auth_error", detail: authErr.message }, { status: 401 });
    }
    const user = authData?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2) subs du user
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", user.id);

    if (subsErr) {
      return NextResponse.json({ ok: false, error: "subs_query_failed", detail: subsErr.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, info: "no_subscriptions_for_user" });
    }

    // 3) envoi web-push
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const payload = {
      title: "Files",
      body: "Notification de test ✅",
      data: { url: "/dashboard/motivation" },
    };

    let sent = 0;

    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };

      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        sent++;
      } catch (e: any) {
        const code = Number(e?.statusCode || e?.status || 0);
        console.error("[push/test] send error", code, e?.message || e);

        // nettoyage si expirée
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e: any) {
    console.error("[push/test] fatal", e);
    return NextResponse.json({ ok: false, error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
