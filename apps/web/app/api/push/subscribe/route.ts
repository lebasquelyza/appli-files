import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyObj = Record<string, any>;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE url or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AnyObj | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    // ✅ Supporte 2 formats:
    // A) nouveau format (plat): { deviceId, scope, endpoint, keys:{p256dh,auth}, userAgent }
    // B) ancien format (nested): { deviceId, scope, subscription:{endpoint, keys:{p256dh,auth}}, userAgent }
    const deviceId = String(body.deviceId || body.device_id || "").trim();
    const scope = String(body.scope || "motivation").trim() || "motivation";

    const nestedSub = body.subscription || body.sub || null;

    const endpoint = String(body.endpoint || nestedSub?.endpoint || "").trim();
    const p256dh = String(body?.keys?.p256dh || nestedSub?.keys?.p256dh || "").trim();
    const auth = String(body?.keys?.auth || nestedSub?.keys?.auth || "").trim();

    const userAgent =
      String(body.userAgent || body.user_agent || req.headers.get("user-agent") || "").trim() || null;

    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "missing_deviceId" }, { status: 400 });
    }
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { ok: false, error: "missing_endpoint_or_keys", debug: { hasEndpoint: !!endpoint, hasP256dh: !!p256dh, hasAuth: !!auth } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
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

    if (error) {
      console.error("[push/subscribe] supabase upsert failed", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // ✅ Réponse claire (utile sur iPhone)
    return NextResponse.json({
      ok: true,
      saved: { deviceId, scope, endpointPrefix: endpoint.slice(0, 32) + "…" },
    });
  } catch (e: any) {
    console.error("[push/subscribe] fatal", e);
    return NextResponse.json(
      { ok: false, error: "fatal", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
