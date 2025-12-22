// apps/web/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_PREFIX = "push:sub:";

function safeParseUrl(raw: string) {
  try {
    const u = new URL(raw);
    return { ok: true as const, url: u };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e) };
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Nettoyage robuste des variables d’env
    const rawUrl = (process.env.UPSTASH_REDIS_REST_URL ?? "")
      .trim()
      .replace(/\s+/g, ""); // enlève espaces / retours ligne partout

    const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();

    // 🔎 Logs de debug (sans exposer le token)
    console.log("[push/subscribe] URL raw:", JSON.stringify(process.env.UPSTASH_REDIS_REST_URL));
    console.log("[push/subscribe] URL cleaned:", JSON.stringify(rawUrl));

    if (!rawUrl || !token) {
      console.error("[push/subscribe] Missing Upstash env", {
        hasUrl: !!rawUrl,
        hasToken: !!token,
      });
      return NextResponse.json(
        { ok: false, error: "missing_upstash_env", hasUrl: !!rawUrl, hasToken: !!token },
        { status: 500 }
      );
    }

    const parsed = safeParseUrl(rawUrl);
    if (!parsed.ok) {
      console.error("[push/subscribe] Invalid UPSTASH_REDIS_REST_URL", {
        rawUrlPreview: rawUrl.slice(0, 80),
        error: parsed.error,
      });
      return NextResponse.json(
        { ok: false, error: "invalid_upstash_url", detail: parsed.error },
        { status: 500 }
      );
    }

    console.log("[push/subscribe] Using Upstash host:", parsed.url.host);

    const body = await req.json().catch(() => null);
    const deviceId = body?.deviceId as string | undefined;
    const subscription = body?.subscription;

    if (!deviceId || !subscription) {
      return NextResponse.json(
        { ok: false, error: "missing_deviceId_or_subscription" },
        { status: 400 }
      );
    }

    // 🔑 Construction URL Upstash REST
    const upstashBase = parsed.url.toString().replace(/\/+$/, "");
    const key = `${KEY_PREFIX}${deviceId}`;
    const upstashUrl = `${upstashBase}/set/${encodeURIComponent(key)}`;

    let r: Response;
    try {
      r = await fetch(upstashUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });
    } catch (e: any) {
      // ❌ Erreur DNS / réseau (celle que tu avais)
      console.error("[push/subscribe] fetch failed", {
        host: parsed.url.host,
        protocol: parsed.url.protocol,
        message: String(e?.message || e),
        cause: e?.cause ? String(e.cause) : undefined,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "upstash_fetch_failed",
          host: parsed.url.host,
          protocol: parsed.url.protocol,
          message: String(e?.message || e),
          cause: e?.cause ? String(e.cause) : undefined,
        },
        { status: 500 }
      );
    }

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("[push/subscribe] Upstash write failed", {
        status: r.status,
        host: parsed.url.host,
        detail: detail.slice(0, 300),
      });

      return NextResponse.json(
        { ok: false, error: "upstash_write_failed", status: r.status, detail },
        { status: 500 }
      );
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
