// apps/web/app/api/push/subscribe/route.ts
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

/**
 * ✅ GET de diagnostic (utile sur iPhone)
 * Ouvre: https://appli.files-coaching.com/api/push/subscribe
 * -> doit afficher un texte "alive"
 */
export async function GET() {
  const hasUrl = !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json(
    {
      ok: true,
      route: "api/push/subscribe",
      alive: true,
      env: { hasSupabaseUrl: hasUrl, hasServiceRoleKey: hasServiceKey },
      hint: "Use POST with { deviceId, scope, subscription, userAgent }",
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  try {
    console.log("[push/subscribe] HIT");

    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    const emailCookie = (cookies().get("app_email")?.value || "").trim().toLowerCase();
    const email = emailCookie || undefined;

    const body = await req.json().catch(() => null);

    const deviceId = (body?.deviceId as string | undefined)?.trim();
    const subscription = body?.subscription as WebPushSubscription | undefined;
    const scope = (body?.scope as string | undefined)?.trim() || "motivation";

    if (!deviceId || !subscription) {
      console.warn("[push/subscribe] missing_deviceId_or_subscription", { hasDeviceId: !!deviceId, hasSub: !!subscription });
      return NextResponse.json({ ok: false, error: "missing_deviceId_or_subscription" }, { status: 400 });
    }

    const endpoint = subscription?.endpoint?.trim();
    const p256dh = subscription?.keys?.p256dh?.trim();
    const auth = subscription?.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      console.warn("[push/subscribe] missing_endpoint_or_keys", {
        hasEndpoint: !!endpoint,
        hasP256dh: !!p256dh,
        hasAuth: !!auth,
      });
      return NextResponse.json({ ok: false, error: "missing_endpoint_or_keys" }, { status: 400 });
    }

    const userAgent = (body?.userAgent as string | undefined) || req.headers.get("user-agent") || undefined;

    console.log("[push/subscribe] payload", {
      hasSession: !!userId,
      hasEmailCookie: !!email,
      scope,
      deviceId,
      endpointPrefix: endpoint.slice(0, 25),
    });

    const supabase = getSupabaseAdmin();

    // ✅ 1) User connecté => push_subscriptions (inchangé)
    if (userId) {
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            device_id: deviceId,
            endpoint,
            p256dh,
            auth,
            user_agent: userAgent,
            scope,
            email: email || null,
          },
          { onConflict: "user_id,device_id" }
        );

      if (error) {
        console.error("[push/subscribe] Supabase upsert failed (push_subscriptions)", error);
        return NextResponse.json({ ok: false, error: error.message, via: "user" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, via: "user" }, { status: 200 });
    }

    // ✅ 2) Pas connecté => TOUJOURS enregistrer en device-only (c'est ce qu'il te faut pour le cron)
    const dev = await supabase
      .from("push_subscriptions_device")
      .upsert(
        {
          device_id: deviceId,
          scope,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id,scope" }
      );

    if (dev.error) {
      console.error("[push/subscribe] Supabase upsert failed (push_subscriptions_device)", dev.error);
      return NextResponse.json({ ok: false, error: dev.error.message, via: "device" }, { status: 500 });
    }

    // ✅ 3) Optionnel: si email cookie existe, on stocke aussi en email (utile si tu veux supporter email un jour)
    if (email) {
      const em = await supabase
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

      if (em.error) {
        console.error("[push/subscribe] Supabase upsert failed (push_subscriptions_email)", em.error);
        // On ne bloque pas, car device est déjà OK
      }
    }

    return NextResponse.json({ ok: true, via: "device", alsoEmail: !!email }, { status: 200 });
  } catch (e: any) {
    console.error("[push/subscribe] Fatal error", e);
    return NextResponse.json(
      { ok: false, error: "fatal", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
