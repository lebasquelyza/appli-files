// apps/web/netlify/functions/push-cron.js
exports.config = { schedule: "*/1 * * * *" };

const TZ = "Europe/Paris";
const WINDOW_MINUTES = 3; // ✅ rattrapage si Netlify est en retard

function dayKeyFromParis(date) {
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(date);
  const map = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };
  return map[wd] || "mon";
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

function minuteWindowsHHmm(now) {
  // ✅ retourne une liste de HH:mm pour maintenant et les N-1 minutes
  const out = [];
  for (let i = 0; i < WINDOW_MINUTES; i++) {
    const d = new Date(now.getTime() - i * 60 * 1000);
    out.push(timeHHmmParis(d));
  }
  // unique
  return [...new Set(out)];
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
  return {
    title: "Files Le Coach",
    message: "Petite action aujourd’hui, grand impact demain. Tu avances. 💪",
  };
}

async function loadSubs(supabase, deviceIdOrNull) {
  let q = supabase
    .from("push_subscriptions_device")
    .select("endpoint, p256dh, auth, device_id")
    .eq("scope", "motivation");

  if (deviceIdOrNull) q = q.eq("device_id", deviceIdOrNull);

  const { data, error } = await q;
  if (error) {
    console.error("[push-cron] subs error:", error.message);
    return [];
  }
  return data || [];
}

async function sendPushToSubs(supabase, webpush, subs, payload) {
  if (!subs.length) return 0;

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

// ✅ NEW: anti-doublon persistant via table motivation_deliveries
async function claimDelivery(supabase, messageId, ymd, hhmm) {
  const { error } = await supabase
    .from("motivation_deliveries")
    .insert({ message_id: messageId, ymd, hhmm, tz: TZ });

  // si conflit unique => déjà envoyé
  if (error) {
    // Supabase renvoie souvent un message type "duplicate key value violates unique constraint"
    const msg = String(error.message || "");
    if (msg.toLowerCase().includes("duplicate")) return false;
    // autre erreur => on log mais on évite d’envoyer en double sans tracking
    console.error("[push-cron] deliveries insert error:", msg);
    return false;
  }

  return true;
}

exports.handler = async (event) => {
  try {
    const PUB = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY || process.env.NEXT_PUBLIC_VAPID_PRIVATE_KEY;
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
    const ymd = dateYmdParis(now);
    const times = minuteWindowsHHmm(now);

    console.log("[push-cron] tick", { ymd, dayKey, times, tz: TZ });

    const { data: rows, error: msgErr } = await supabase
      .from("motivation_messages")
      .select("id, target, mode, content, days, time, active, device_id")
      .eq("active", true)
      .eq("target", "ME")
      .in("time", times);

    if (msgErr) {
      console.error("[push-cron] motivation_messages error:", msgErr.message);
      return { statusCode: 500, body: "messages_query_failed" };
    }

    const due = (rows || []).filter((m) => parseDays(m.days).includes(dayKey));
    console.log("[push-cron] due", { count: due.length });

    let processed = 0;
    let sent = 0;
    let skippedAlreadySent = 0;

    for (const msg of due) {
      processed++;

      const claimed = await claimDelivery(supabase, msg.id, ymd, msg.time);
      if (!claimed) {
        skippedAlreadySent++;
        continue;
      }

      const custom = String(msg.content || "").trim();
      const coach = await pickCoachMessage();

      // tag anti-doublons côté OS + utile debug
      const tag = `motivation|${msg.id}|${ymd}|${msg.time}`;

      const payload = {
        title: coach.title,
        body: custom ? custom : coach.message,
        scope: "motivation",
        tag,
        data: { url: "/dashboard/motivation", scope: "motivation", tag },
      };

      const did = String(msg.device_id || "").trim();

      if (did) {
        const subs = await loadSubs(supabase, did);
        console.log("[push-cron] send targeted", { msgId: msg.id, time: msg.time, deviceId: did, subs: subs.length });
        sent += await sendPushToSubs(supabase, webpush, subs, payload);
      } else {
        const all = await loadSubs(supabase, null);
        console.log("[push-cron] send fallback all", { msgId: msg.id, time: msg.time, subs: all.length });
        sent += await sendPushToSubs(supabase, webpush, all, payload);
      }
    }

    const result = { ok: true, ymd, dayKey, times, due: due.length, processed, sent, skippedAlreadySent };
    console.log("[push-cron] done", result);

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    console.error("[push-cron] fatal error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
