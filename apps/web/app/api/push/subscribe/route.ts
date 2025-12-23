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
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE url or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = (session?.user as any)?.email as string | undefined;

    if (!email) {
      return NextResponse.json({ ok: false, error: "unauthorized_no_email" }, { status: 401 });
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

    // ✅ 1) récupérer le profile via email
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id,email,pseudo")
      .eq("email", email)
      .maybeSingle<{ id: string; email: string | null; pseudo: string | null }>();

    if (profErr) {
      console.error("[push/subscribe] profile lookup failed", profErr);
      return NextResponse.json({ ok: false, error: "profile_lookup_failed" }, { status: 500 });
    }

    if (!profile?.id) {
      return NextResponse.json(
        { ok: false, error: "no_profile_for_email", hint: "Vérifie le trigger handle_new_user sur auth.users." },
        { status: 401 }
      );
    }

    // ✅ option : exiger un pseudo avant activation (décommente si tu veux)
    // if (!profile.pseudo || profile.pseudo.trim().length === 0) {
    //   return NextResponse.json({ ok: false, error: "missing_pseudo" }, { status: 400 });
    // }

    // ✅ 2) upsert subscription
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: profile.id, // UUID auth.users.id
          device_id: deviceId,
          endpoint,
          p256dh,
          auth,
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
    console.error("[push/subscribe] fatal", e);
    return NextResponse.json({ ok: false, error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
