// apps/web/netlify/functions/push-cron.js

exports.config = { schedule: "*/1 * * * *" };

const TZ = "Europe/Paris";

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

async function sendPushToSubs(supabase, webpush, subs, payload, tableName) {
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
        // supprime l'endpoint mort
        try {
          await supabase.from(tableName).delete().eq("endpoint", s.endpoint);
        } catch {}
      }
    }
  }

  return ok;
}

// ✅ Envoi via user_id (NextAuth / Supabase user)
async function sendPushToUser(supabase, webpush, userId, payload) {
  if (!userId) return 0;

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("scope", "motivation")
    .eq("user_id", userId);

  if (error) {
    console.error("[push-cron] supabase subs error:", error.message);
    return 0;
  }

  return sendPushToSubs(supabase, webpush, subs, payload, "push_subscriptions");
}

// ✅ Envoi via device_id (sans auth)
async function sendPushToDevice(supabase, webpush, deviceId, payload) {
  if (!deviceId) return 0;

  const { data: subs, error } = await supabase
    .from("push_subscriptions_device")
    .select("endpoint, p256dh, auth")
    .eq("scope", "motivation")
    .eq("device_id", deviceId);

  if (error) {
    console.error("[push-cron] supabase device subs error:", error.message);
    return 0;
  }

  return sendPushToSubs(supabase, webpush, subs, payload, "push_subscriptions_device");
}

exports.handler = async (event) => {
  try {
    // (optionnel) secret de protection
    if (process.env.CRON_SECRET) {
      const secret =
        event.headers?.["x-cron-secret"] ||
        event.headers?.["X-Cron-Secret"] ||
        event.queryStringParameters?.secret;

      if (secret !== process.env.CRON_SECRET) {
        return { statusCode: 401, body: "Unauthorized" };
      }
    }

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

    // ✅ IMPORTANT: inclure device_id pour "ME sans auth"
    const { data: rows, error: msgErr } = await supabase
      .from("motivation_messages")
      .select("id, user_id, device_id, target, mode, content, days, time, active")
      .eq("active", true)
      .eq("time", hhmm);

    if (msgErr) {
      console.error("[push-cron] supabase motivation_messages error:", msgErr.message);
      return { statusCode: 500, body: "messages_query_failed" };
    }

    const due = (rows || []).filter((m) => parseDays(m.days).includes(dayKey));
    if (!due.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, at: sendKeyBase, due: 0, processed: 0, sent: 0 }),
      };
    }

    // FRIENDS recipients resolution (inchangé)
    const friendMsgIds = due.filter((m) => m.target === "FRIENDS").map((m) => m.id);
    const recByMsg = {};

    if (friendMsgIds.length) {
      const { data: recs, error: recErr } = await supabase
        .from("motivation_recipients")
        .select("message_id, recipient_user_id")
        .in("message_id", friendMsgIds);

      if (recErr) {
        console.error("[push-cron] supabase recipients error:", recErr.message);
        return { statusCode: 500, body: "recipients_query_failed" };
      }

      for (const r of recs || []) {
        if (!recByMsg[r.message_id]) recByMsg[r.message_id] = [];
        recByMsg[r.message_id].push(r.recipient_user_id);
      }
    }

    let processed = 0;
    let sent = 0;

    for (const msg of due) {
      // ✅ ME + COACH => envoi à soi (device_id prioritaire sinon user_id)
      if (msg.target === "ME" && msg.mode === "COACH") {
        const send_key = sendKeyBase;

        const ins = await supabase.from("motivation_dispatches").insert({
          message_id: msg.id,
          send_key,
        });

        if (ins.error) {
          // (optionnel) debug utile
          console.warn("[push-cron] dispatch insert failed:", ins.error.message, { message_id: msg.id, send_key });
          continue;
        }

        processed++;

        const coach = await pickCoachMessage();
        const payload = {
          title: coach.title || "Files Le Coach",
          body: coach.message,
          scope: "motivation",
          data: { url: "/dashboard/motivation", scope: "motivation" },
        };

        if (msg.device_id) {
          sent += await sendPushToDevice(supabase, webpush, msg.device_id, payload);
        } else if (msg.user_id) {
          sent += await sendPushToUser(supabase, webpush, msg.user_id, payload);
        }

        continue;
      }

      // FRIENDS + CUSTOM => envoi aux recipients (inchangé, via user_id)
      if (msg.target === "FRIENDS" && msg.mode === "CUSTOM") {
        const recipients = recByMsg[msg.id] || [];
        if (!recipients.length) continue;

        processed++;

        for (const rid of recipients) {
          const send_key = `${sendKeyBase}|${rid}`;

          const ins = await supabase.from("motivation_dispatches").insert({
            message_id: msg.id,
            send_key,
          });

          if (ins.error) {
            console.warn("[push-cron] dispatch insert failed:", ins.error.message, {
              message_id: msg.id,
              send_key,
              recipient: rid,
            });
            continue;
          }

          sent += await sendPushToUser(supabase, webpush, rid, {
            title: "Files",
            body: msg.content,
            scope: "motivation",
            data: { url: "/dashboard/motivation", scope: "motivation" },
          });
        }

        continue;
      }

      console.warn("[push-cron] skipped message (unexpected target/mode):", msg.id, msg.target, msg.mode);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, at: sendKeyBase, due: due.length, processed, sent }),
    };
  } catch (e) {
    console.error("[push-cron] fatal error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
