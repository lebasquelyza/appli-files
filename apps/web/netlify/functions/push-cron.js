// apps/web/netlify/functions/push-cron.js

// ✅ On passe à toutes les minutes pour supporter n'importe quelle heure HH:mm
// (sinon, si tu gardes */5, un message prévu à 09:02 ne partira jamais)
exports.config = { schedule: "*/1 * * * *" };

// ENV requis sur Netlify :
// DATABASE_URL (Prisma)
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (optionnel mais recommandé) CRON_SECRET

const TZ = "Europe/Paris";

function dayKeyFromParis(date) {
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: TZ,
  }).format(date);

  const map = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  };
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

async function pickCoachMessage(prisma, lang = "fr") {
  const list = await prisma.coachMotivation.findMany({
    where: { active: true, lang },
    select: { title: true, message: true },
  });

  if (!list.length) {
    return {
      title: "Files Le Coach",
      message: "Petite action aujourd’hui, grand impact demain. Tu avances. 💪",
    };
  }

  const item = list[Math.floor(Math.random() * list.length)];
  return {
    title: item.title || "Files Le Coach",
    message: item.message,
  };
}

async function sendPushToUser(prisma, webpush, userId, payload) {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  if (!subs.length) return 0;

  let ok = 0;

  for (const s of subs) {
    const subscription = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    };

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      ok++;
    } catch (e) {
      const code = Number(e?.statusCode || e?.status || 0);
      console.error("[push-cron] push error:", code, e?.message || e);

      // subscription expirée => nettoyage
      if (code === 410 || code === 404) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: s.endpoint },
        });
      }
    }
  }

  return ok;
}

exports.handler = async (event) => {
  try {
    // (Optionnel) sécuriser l’appel manuel
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

    // Prisma côté Netlify function
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const now = new Date();
    const dayKey = dayKeyFromParis(now);     // "mon".."sun"
    const hhmm = timeHHmmParis(now);         // "HH:mm"
    const ymd = dateYmdParis(now);           // "YYYY-MM-DD"
    const sendKey = `${ymd}|${hhmm}|${TZ}`;  // anti-doublon

    // 1) Messages dus maintenant
    // - active
    // - time match
    // - days contains dayKey
    const due = await prisma.motivationMessage.findMany({
      where: {
        active: true,
        time: hhmm,
        days: { contains: dayKey },
      },
      include: {
        recipients: true, // besoin pour FRIENDS sélection
      },
    });

    let processed = 0;
    let sent = 0;

    for (const msg of due) {
      // 2) Anti-doublon : 1 envoi max / msg / minute
      try {
        await prisma.motivationDispatch.create({
          data: {
            motivationMessageId: msg.id,
            sendKey,
          },
        });
      } catch {
        // unique conflict => déjà envoyé
        continue;
      }

      processed++;

      // 3) ME => Files Le Coach (COACH)
      if (msg.target === "ME" && msg.mode === "COACH") {
        const coach = await pickCoachMessage(prisma, "fr");
        sent += await sendPushToUser(prisma, webpush, msg.userId, {
          title: coach.title || "Files Le Coach",
          body: coach.message,
          data: { url: "/dashboard/motivation" },
        });
        continue;
      }

      // 4) FRIENDS => message custom aux destinataires sélectionnés
      if (msg.target === "FRIENDS" && msg.mode === "CUSTOM") {
        const recipients = (msg.recipients || []).map((r) => r.recipientUserId);

        for (const rid of recipients) {
          sent += await sendPushToUser(prisma, webpush, rid, {
            title: "Files",
            body: msg.content,
            data: { url: "/dashboard/motivation" },
          });
        }
        continue;
      }

      // Si mode/target inattendus, on skip (mais on a quand même locké le dispatch)
      console.warn("[push-cron] skipped message (unexpected target/mode):", msg.id, msg.target, msg.mode);
    }

    await prisma.$disconnect();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        at: sendKey,
        due: due.length,
        processed,
        sent,
      }),
    };
  } catch (e) {
    console.error("[push-cron] fatal error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};

