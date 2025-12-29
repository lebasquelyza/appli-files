// apps/web/netlify/functions/push-cron.js
exports.config = { schedule: "*/1 * * * *" };

const TZ = "Europe/Paris";

function dayKeyFromParis(date) {
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(date);
  return { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" }[wd] || "mon";
}

function timeHHmmParis(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hh = parts.find((p) => p.type === "hour")?.value || "00";
  const mm = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hh}:${mm}`;
}

function dateYmdParis(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value || "1970";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const d = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${d}`;
}

function parseDays(daysStr) {
  return String(daysStr || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function getSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function pickCoachMessage() {
  // tu peux enrichir plus tard si tu veux
  return {
    title: "Files Le Coach",
    message: "Petite action aujourd’hui, grand impact demain. Tu avances. 💪",
  };
}

async function sendPushToDevices(supabase, webpush, payload) {
  const { data: subs, error } = await supabase
    .from("push_subscriptions_device")
    .select("endpoint, p256dh, auth")
    .eq("scope", "motivation");

  if (error) {
    console.error("[push-cron] subs error:", error.message);
    return 0;
  }
  if (!subs?.length) return 0;

  let ok = 0;

  for (const s of subs) {
    const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      ok++;
    } catch (e) {
      const code = Number(e?.statusCode || e?.status || 0);
      console.error("[push-cron] push error:", code, e?.message || e);

      if (code === 410 || code === 404) {
        await supabase.from("push_subscriptions_device").delete().eq("endpoint", s.endpoint);
      }
    }
  }

  return ok;
}

exports.handler = async (event) => {
  try {
    const PUB = process.env.VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

    if (!PUB || !PRIV) {
      console.error("[push-cron] Missing VAPID keys");
      return { statusCode: 500, body: "missing_vapid_keys" };
    }

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const supabase = getSupabaseAdmin();

    const now = new Date();
    const dayKey = dayKeyFromParis(now);
    const hhmm = timeHHmmParis(now);
    const ymd = dateYmdParis(now);
    const sendKeyBase = `${ymd}|${hhmm}|${TZ}`;

    // messages actifs à l'heure pile
    const { data: rows, error: msgErr } = await supabase
      .from("motivation_messages")
      .select("id, target, mode, content, days, time, active")
      .eq("active", true)
      .eq("time", hhmm);

    if (msgErr) {
      console.error("[push-cron] motivation_messages error:", msgErr.message);
      return { statusCode: 500, body: "messages_query_failed" };
    }

    const due = (rows || []).filter((m) => parseDays(m.days).includes(dayKey));
    if (!due.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, at: sendKeyBase, due: 0, sent: 0 }),
      };
    }

    let sent = 0;

    for (const msg of due) {
      // ✅ “Pour moi” = soit msg.content si présent, sinon coach
      if (msg.target === "ME") {
        const custom = String(msg.content || "").trim();
        const coach = await pickCoachMessage();

        const title = "Files Le Coach — From Coaching";
        const body = custom ? custom : coach.message;

        sent += await sendPushToDevices(supabase, webpush, {
          title,
          body,
          scope: "motivation",
          data: { url: "/dashboard/motivation", scope: "motivation" },
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, at: sendKeyBase, due: due.length, sent }),
    };
  } catch (e) {
    console.error("[push-cron] fatal error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
