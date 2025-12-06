// apps/web/app/dashboard/motivation/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { translations } from "@/app/i18n/translations";

/* ---------------- i18n helpers (client) ---------------- */
type Lang = "fr" | "en";

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function getLangClient(): Lang {
  if (typeof document === "undefined") return "fr";
  // 🔁 on lit le nouveau cookie fc-lang-v2
  const match = document.cookie.match(/(?:^|; )fc-lang-v2=(fr|en)/);
  const val = match?.[1] as Lang | undefined;
  return val === "en" ? "en" : "fr";
}

function useT() {
  const [lang, setLang] = useState<Lang>("fr");

  useEffect(() => {
    setLang(getLangClient());
  }, []);

  const t = useCallback(
    (path: string, fallback?: string) => {
      const dict = translations[lang] as any;
      const v = getFromPath(dict, path);
      if (typeof v === "string") return v;
      return fallback ?? path;
    },
    [lang]
  );

  return t;
}

/* ---------------- Types & const ---------------- */

type CoachingNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string; // ISO
  read: boolean;
  source?: string; // ex: "Files Coaching"
  rating?: number; // 0–5
};

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type MotivationMessageApi = {
  id: string;
  userId: string;
  target: string; // "ME" | "FRIENDS"
  content: string;
  days: string; // "mon,tue,wed"
  time: string; // "HH:mm"
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const SIDE_PADDING = 16;
const PAGE_MAX_WIDTH = 740;

const ALL_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Longueur max pour le message
const CUSTOM_MESSAGE_MAX = 240;

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function MotivationPage() {
  const { data: session, status } = useSession();
  const t = useT();

  const [notifications, setNotifications] = useState<CoachingNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [sending, setSending] = useState(false);

  // Texte unique pour les deux usages (pour lui / pour ses amis)
  const [message, setMessage] = useState("");
  const remaining = CUSTOM_MESSAGE_MAX - message.length;

  // Step 2 : choix des jours / heure après clic sur Programmer/Partager
  const [scheduleTarget, setScheduleTarget] = useState<null | "ME" | "FRIENDS">(null);
  const [scheduleDays, setScheduleDays] = useState<DayKey[]>([]);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [savingSelf, setSavingSelf] = useState(false);
  const [sharingCustom, setSharingCustom] = useState(false);

  // Notifs en dur (mock) au chargement
  useEffect(() => {
    setNotifications([
      {
        id: "1",
        title: t("motivation.mock.first.title", "Tu progresses 💪"),
        message: t(
          "motivation.mock.first.message",
          "Super séance hier ! Continue sur cette lancée, la régularité fait toute la différence."
        ),
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        read: false,
        source: t("motivation.mock.source", "Files Coaching"),
      },
      {
        id: "2",
        title: t("motivation.mock.second.title", "Rappel douceur"),
        message: t(
          "motivation.mock.second.message",
          "Même une petite séance vaut mieux que rien. 10 minutes aujourd’hui, c’est déjà gagné."
        ),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        read: true,
        source: t("motivation.mock.source", "Files Coaching"),
        rating: 4,
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les messages déjà programmés depuis l'API (backend Prisma)
  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch("/api/motivation/messages");
        if (!res.ok) return;
        const data: MotivationMessageApi[] = await res.json();

        if (cancelled || !Array.isArray(data)) return;

        setNotifications((prev) => {
          // on évite de dupliquer si on re-fetch (par id)
          const existingIds = new Set(prev.map((n) => n.id));
          const extra: CoachingNotification[] = data
            .filter((msg) => !existingIds.has(msg.id))
            .map((msg) => {
              const isMe = msg.target === "ME";
              const daysLabel = msg.days
                .split(",")
                .filter(Boolean)
                .join(", ");
              return {
                id: msg.id,
                title: isMe
                  ? t(
                      "motivation.selfNotification.title",
                      "Message programmé pour toi ✅"
                    )
                  : t(
                      "motivation.customNotification.title",
                      "Message programmé pour tes amis 💌"
                    ),
                message: msg.content,
                createdAt: msg.createdAt,
                read: true,
                source: isMe
                  ? t(
                      "motivation.selfNotification.source",
                      `Rappel perso – ${daysLabel} à ${msg.time}`
                    )
                  : t(
                      "motivation.customNotification.source",
                      `Toi → tes amis – ${daysLabel} à ${msg.time}`
                    ),
              };
            });

          return [...extra, ...prev];
        });
      } catch (e) {
        console.error("Error loading motivation messages", e);
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const visibleNotifications = useMemo(
    () =>
      filter === "all"
        ? notifications
        : notifications.filter((n) => !n.read),
    [notifications, filter]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Noter une notification (100% côté client)
  const setRating = (id: string, rating: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, rating } : n))
    );
  };

  const getDayLabel = (day: DayKey) =>
    t(
      `motivation.dayLabels.${day}`,
      {
        mon: "Lundi",
        tue: "Mardi",
        wed: "Mercredi",
        thu: "Jeudi",
        fri: "Vendredi",
        sat: "Samedi",
        sun: "Dimanche",
      }[day]
    );

  const toggleScheduleDay = (day: DayKey) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Notification de test générée directement par l'appli (pas de backend)
  const sendTestNotification = async () => {
    if (sending) return;
    setSending(true);

    const samples: Array<{ title: string; message: string }> = [
      {
        title: t("motivation.samples.onLacheRien.title", "On lâche rien 🔥"),
        message: t(
          "motivation.samples.onLacheRien.message",
          "Tu es plus proche de ton objectif aujourd’hui qu’hier. Une action de plus, même petite."
        ),
      },
      {
        title: t("motivation.samples.respireEtAvance.title", "Respire & avance"),
        message: t(
          "motivation.samples.respireEtAvance.message",
          "Ne cherche pas la perfection. Cherche la progression. Un pas après l’autre."
        ),
      },
      {
        title: t("motivation.samples.tuPeuxLeFaire.title", "Tu peux le faire ✨"),
        message: t(
          "motivation.samples.tuPeuxLeFaire.message",
          "Rappelle-toi pourquoi tu as commencé. Tu as déjà traversé plus dur que ça."
        ),
      },
      {
        title: t("motivation.samples.tonFuturToi.title", "Ton futur toi te remercie"),
        message: t(
          "motivation.samples.tonFuturToi.message",
          "Chaque décision d’aujourd’hui construit la personne que tu seras dans 3 mois."
        ),
      },
      {
        title: t("motivation.samples.miniSeance.title", "Mini séance, maxi impact"),
        message: t(
          "motivation.samples.miniSeance.message",
          "Si tu n’as pas le temps pour 30 minutes, fais-en 5. Ce qui compte, c’est le mouvement."
        ),
      },
      {
        title: t("motivation.samples.recommence.title", "Recommence autant que nécessaire"),
        message: t(
          "motivation.samples.recommence.message",
          "Tomber fait partie du jeu. Ce qui compte, c’est à quelle vitesse tu te relèves."
        ),
      },
      {
        title: t("motivation.samples.tuNESPasSeul.title", "Tu n’es pas seul·e"),
        message: t(
          "motivation.samples.tuNESPasSeul.message",
          "Demander de l’aide, c’est aussi une forme de force. Tu fais ça pour TOI."
        ),
      },
      {
        title: t("motivation.samples.cestTonMoment.title", "C’est ton moment"),
        message: t(
          "motivation.samples.cestTonMoment.message",
          "Bloque 10 minutes rien que pour toi maintenant. Ton corps et ta tête te diront merci."
        ),
      },
    ];

    const sample = samples[Math.floor(Math.random() * samples.length)];
    const nowIso = new Date().toISOString();

    setNotifications((prev) => [
      {
        id: nowIso,
        title: sample.title,
        message: sample.message,
        createdAt: nowIso,
        read: false,
        source: t("motivation.mock.sourceTest", "Files Coaching (test)"),
      },
      ...prev,
    ]);

    setTimeout(() => setSending(false), 400);
  };

  // Ouverture de l'étape de programmation / partage (on demande jours + heure)
  const openSchedule = (target: "ME" | "FRIENDS") => {
    if (!message.trim()) return;
    setScheduleTarget(target);
    // valeur par défaut : tous les jours de semaine si rien sélectionné
    setScheduleDays((prev) =>
      prev.length > 0 ? prev : ["mon", "tue", "wed", "thu", "fri"]
    );
  };

  const cancelSchedule = () => {
    setScheduleTarget(null);
    setScheduleDays([]);
  };

  // Validation de l'étape jours + heure -> appel API
  const confirmSchedule = async () => {
    const trimmed = message.trim();
    if (!trimmed || !scheduleTarget) return;
    if (scheduleDays.length === 0) {
      console.error("No days selected");
      return;
    }

    const target = scheduleTarget;
    if (target === "ME") setSavingSelf(true);
    if (target === "FRIENDS") setSharingCustom(true);

    try {
      const res = await fetch("/api/motivation/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target,
          content: trimmed,
          days: scheduleDays,
          time: scheduleTime,
        }),
      });

      if (!res.ok) {
        console.error("Error saving message", await res.json());
      } else {
        const msg: MotivationMessageApi = await res.json();
        const isMe = msg.target === "ME";

        const daysLabel = msg.days
          .split(",")
          .filter(Boolean)
          .join(", ");

        setNotifications((prev) => [
          {
            id: msg.id ?? `${isMe ? "self" : "custom"}-${Date.now()}`,
            title: isMe
              ? t(
                  "motivation.selfNotification.title",
                  "Message programmé pour toi ✅"
                )
              : t(
                  "motivation.customNotification.title",
                  "Message programmé pour tes amis 💌"
                ),
            message: trimmed,
            createdAt: msg.createdAt ?? new Date().toISOString(),
            read: true,
            source: isMe
              ? t(
                  "motivation.selfNotification.source",
                  `Rappel perso – ${daysLabel || scheduleDays
                    .map((d) => getDayLabel(d))
                    .join(", ")} à ${msg.time || scheduleTime}`
                )
              : t(
                  "motivation.customNotification.source",
                  `Toi → tes amis – ${daysLabel || scheduleDays
                    .map((d) => getDayLabel(d))
                    .join(", ")} à ${msg.time || scheduleTime}`
                ),
          },
          ...prev,
        ]);

        // on vide le message et on ferme l'étape
        setMessage("");
        cancelSchedule();
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (target === "ME") setSavingSelf(false);
      if (target === "FRIENDS") setSharingCustom(false);
    }
  };

  if (status === "loading") {
    return (
      <div
        className="container"
        style={{
          paddingTop: 18,
          paddingBottom: 22,
          paddingLeft: SIDE_PADDING,
          paddingRight: SIDE_PADDING,
          maxWidth: PAGE_MAX_WIDTH,
          margin: "0 auto",
        }}
      >
        <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>
          {t("motivation.pageTitle", "Motivation")}
        </h1>
        <p className="lead" style={{ fontSize: 12, marginTop: 2 }}>
          {t("motivation.loading.subtitle", "Chargement…")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="container"
      style={{
        paddingTop: 18,
        paddingBottom: 22,
        paddingLeft: SIDE_PADDING,
        paddingRight: SIDE_PADDING,
        maxWidth: PAGE_MAX_WIDTH,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        className="page-header"
        style={{
          marginBottom: 10,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>
            {t("motivation.pageTitle", "Motivation")}
          </h1>
          <p
            className="lead"
            style={{
              fontSize: 12,
              marginTop: 2,
              color: "#6b7280",
            }}
          >
            {t(
              "motivation.pageSubtitle",
              "Crée tes propres messages de motivation pour toi ou pour tes amis, et retrouve ici l’historique."
            )}
          </p>
        </div>
        {session && (
          <div
            style={{
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 999,
              background: "#ecfdf3",
              color: "#166534",
              alignSelf: "flex-start",
            }}
          >
            {t("motivation.header.connectedAs", "Connecté en tant que")}{" "}
            {session.user?.email ??
              t("motivation.header.clientFallback", "client")}
          </div>
        )}
      </div>

      {/* Barre d’actions & filtres */}
      <div
        className="card"
        style={{
          padding: 10,
          marginBottom: 10,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 12,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, color: "#374151" }}>
          <strong>{unreadCount}</strong>{" "}
          {t(
            "motivation.bar.unreadSuffix",
            "notification(s) non lue(s)."
          )}
          <br />
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {t(
              "motivation.bar.info",
              "Les messages que tu programmes ou envoies s’affichent ici."
            )}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setFilter("all")}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                border: "none",
                background:
                  filter === "all" ? "#111827" : "transparent",
                color: filter === "all" ? "#ffffff" : "#6b7280",
                cursor: "pointer",
              }}
            >
              {t("motivation.bar.filterAll", "Tout")}
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                border: "none",
                background:
                  filter === "unread" ? "#111827" : "transparent",
                color: filter === "unread" ? "#ffffff" : "#6b7280",
                cursor: "pointer",
              }}
            >
              {t("motivation.bar.filterUnread", "Non lues")}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-dash"
            style={{ fontSize: 12 }}
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            {t(
              "motivation.bar.markAllRead",
              "Tout marquer comme lu"
            )}
          </button>

          <button
            type="button"
            className="btn"
            style={{
              fontSize: 12,
              background: "#111827",
              color: "#ffffff",
              borderRadius: 999,
              padding: "6px 10px",
            }}
            onClick={sendTestNotification}
            disabled={sending}
          >
            {sending
              ? t("motivation.bar.sending", "Envoi...")
              : t(
                  "motivation.bar.sendTest",
                  "Envoyer une notif de test"
                )}
          </button>
        </div>
      </div>

      {/* Bloc unique : message pour toi ET pour tes amis */}
      <div
        className="card"
        style={{
          padding: 10,
          marginBottom: 10,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 12,
          display: "grid",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {t(
            "motivation.messageBlock.title",
            "Crée ton message motivant"
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          {t(
            "motivation.messageBlock.subtitle",
            "Tu peux l’utiliser pour te motiver toi, ou pour motiver tes amis qui ont l’appli."
          )}
        </div>

        <textarea
          value={message}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= CUSTOM_MESSAGE_MAX) {
              setMessage(value);
            }
          }}
          rows={3}
          placeholder={t(
            "motivation.messageBlock.placeholder",
            "Ex : « Même 10 minutes aujourd’hui, c’est déjà une victoire. On le fait ensemble ? 💪 »"
          )}
          style={{
            marginTop: 4,
            width: "100%",
            fontSize: 13,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            resize: "vertical",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: remaining < 0 ? "#b91c1c" : "#6b7280",
            }}
          >
            {remaining}{" "}
            {t(
              "motivation.messageBlock.remaining",
              "caractères restants"
            )}
          </span>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn btn-dash"
              onClick={() => openSchedule("ME")}
              disabled={!message.trim()}
              style={{
                fontSize: 12,
                borderRadius: 999,
                padding: "6px 10px",
                cursor: !message.trim() ? "not-allowed" : "pointer",
              }}
            >
              {t(
                "motivation.messageBlock.programForMe",
                "Programmer pour moi"
              )}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => openSchedule("FRIENDS")}
              disabled={!message.trim()}
              style={{
                fontSize: 12,
                background: "#111827",
                color: "#ffffff",
                borderRadius: 999,
                padding: "6px 10px",
                opacity: !message.trim() ? 0.6 : 1,
                cursor: !message.trim() ? "not-allowed" : "pointer",
              }}
            >
              {t(
                "motivation.messageBlock.shareWithFriends",
                "Partager à mes amis"
              )}
            </button>
          </div>
        </div>

        {/* Étape 2 : choix des jours + heure */}
        {scheduleTarget && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #e5e7eb",
              display: "grid",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
              }}
            >
              {scheduleTarget === "ME"
                ? t(
                    "motivation.schedule.titleSelf",
                    "Pour toi : choisis les jours et l’heure de ce message"
                  )
                : t(
                    "motivation.schedule.titleFriends",
                    "Pour tes amis : choisis les jours et l’heure de ce message"
                  )}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
              }}
            >
              {t(
                "motivation.schedule.subtitle",
                "Ce message sera enregistré et utilisé pour envoyer des notifications aux jours et à l’heure choisis."
              )}
            </div>

            {/* Jours */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 2,
              }}
            >
              {ALL_DAYS.map((day) => {
                const active = scheduleDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleScheduleDay(day)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                      cursor: "pointer",
                      background: active ? "#111827" : "#ffffff",
                      color: active ? "#ffffff" : "#374151",
                    }}
                  >
                    {getDayLabel(day)}
                  </button>
                );
              })}
            </div>

            {/* Heure */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  color: "#374151",
                }}
              >
                {t("motivation.schedule.timeLabel", "Heure :")}
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              />
            </div>

            {/* Actions de validation */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 6,
                marginTop: 6,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-dash"
                onClick={cancelSchedule}
                style={{
                  fontSize: 12,
                  borderRadius: 999,
                  padding: "6px 10px",
                }}
              >
                {t("motivation.schedule.cancel", "Annuler")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={confirmSchedule}
                disabled={
                  scheduleDays.length === 0 ||
                  !scheduleTime ||
                  !message.trim() ||
                  savingSelf ||
                  sharingCustom
                }
                style={{
                  fontSize: 12,
                  background: "#111827",
                  color: "#ffffff",
                  borderRadius: 999,
                  padding: "6px 10px",
                  opacity:
                    scheduleDays.length === 0 ||
                    !scheduleTime ||
                    !message.trim() ||
                    savingSelf ||
                    sharingCustom
                      ? 0.6
                      : 1,
                  cursor:
                    scheduleDays.length === 0 ||
                    !scheduleTime ||
                    !message.trim() ||
                    savingSelf ||
                    sharingCustom
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {savingSelf || sharingCustom
                  ? t(
                      "motivation.schedule.saving",
                      "Enregistrement..."
                    )
                  : t(
                      "motivation.schedule.confirm",
                      "Valider ce message"
                    )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste des notifications */}
      <div className="grid gap-3">
        {visibleNotifications.length === 0 ? (
          <div
            className="card"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px dashed #e5e7eb",
              background: "#f9fafb",
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            {t(
              "motivation.empty.title",
              "Aucune notification à afficher pour le moment."
            )}
            <br />
            {t(
              "motivation.empty.hint",
              'Programme un message ou utilise le bouton “Envoyer une notif de test” pour voir le rendu.'
            )}
          </div>
        ) : (
          visibleNotifications.map((n) => (
            <article
              key={n.id}
              className="card"
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: n.read ? "#ffffff" : "#ecfdf3",
                display: "grid",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {n.title}
                  {!n.read && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: "#16a34a",
                        color: "#f9fafb",
                      }}
                    >
                      {t("motivation.card.badgeNew", "Nouveau")}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatTime(n.createdAt)}
                </div>
              </div>
              {n.source && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                  }}
                >
                  {t("motivation.card.sourcePrefix", "Source :")}{" "}
                  {n.source}
                </div>
              )}
              <p
                style={{
                  fontSize: 13,
                  color: "#374151",
                  marginTop: 2,
                  marginBottom: 4,
                }}
              >
                {n.message}
              </p>

              {/* Notation */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    marginRight: 2,
                  }}
                >
                  {t("motivation.card.ratingLabel", "Ta note :")}
                </span>
                <div>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(n.id, star)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        margin: "0 1px",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 16,
                          color:
                            star <= (n.rating ?? 0)
                              ? "#facc15"
                              : "#d1d5db",
                        }}
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                {typeof n.rating === "number" && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                    }}
                  >
                    ({n.rating}/5)
                  </span>
                )}
              </div>

              {!n.read && (
                <div style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-dash"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    onClick={() => markAsRead(n.id)}
                  >
                    {t(
                      "motivation.card.markRead",
                      "Marquer comme lu"
                    )}
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
