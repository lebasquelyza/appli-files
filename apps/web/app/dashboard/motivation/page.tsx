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

const SIDE_PADDING = 16;
const PAGE_MAX_WIDTH = 740;

const ALL_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Longueur max pour le message perso / amis
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

  // Préférences d’envoi (toujours côté client)
  const [activeDays, setActiveDays] = useState<DayKey[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);
  const [prefTime, setPrefTime] = useState("09:00");

  // Message perso (pour lui-même)
  const [selfMessage, setSelfMessage] = useState("");
  const [savingSelf, setSavingSelf] = useState(false);

  // Message pour ses amis
  const [customMessage, setCustomMessage] = useState("");
  const [sharingCustom, setSharingCustom] = useState(false);
  const customRemaining = CUSTOM_MESSAGE_MAX - customMessage.length;

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
    // on ne veut pas relancer à chaque changement de t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Toggle jour actif / inactif (toujours local)
  const toggleDay = (day: DayKey) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
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

  // "Programmation" du message perso : appel API + feedback visuel
  const saveSelfMessage = async () => {
    const trimmed = selfMessage.trim();
    if (!trimmed || savingSelf) return;

    setSavingSelf(true);

    try {
      const res = await fetch("/api/motivation/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: "ME",
          content: trimmed,
          days: activeDays,
          time: prefTime,
        }),
      });

      if (!res.ok) {
        console.error("Error saving self message", await res.json());
      } else {
        const msg = await res.json();
        setNotifications((prev) => [
          {
            id: msg.id ?? `self-${Date.now()}`,
            title: t(
              "motivation.selfNotification.title",
              "Message programmé pour toi ✅"
            ),
            message: trimmed,
            createdAt: msg.createdAt ?? new Date().toISOString(),
            read: true,
            source: t(
              "motivation.selfNotification.source",
              "Rappel perso"
            ),
          },
          ...prev,
        ]);
        setSelfMessage("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSelf(false);
    }
  };

  // Message pour les amis : appel API + feedback visuel
  const shareCustomMessage = async () => {
    const trimmed = customMessage.trim();
    if (!trimmed || sharingCustom) return;

    setSharingCustom(true);

    try {
      const res = await fetch("/api/motivation/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: "FRIENDS",
          content: trimmed,
          days: activeDays,
          time: prefTime,
        }),
      });

      if (!res.ok) {
        console.error("Error saving friends message", await res.json());
      } else {
        const msg = await res.json();
        setNotifications((prev) => [
          {
            id: msg.id ?? `custom-${Date.now()}`,
            title: t(
              "motivation.customNotification.title",
              "Message envoyé à tes amis 💌"
            ),
            message: trimmed,
            createdAt: msg.createdAt ?? new Date().toISOString(),
            read: true,
            source: t(
              "motivation.customNotification.source",
              "Toi → tes amis"
            ),
          },
          ...prev,
        ]);
        setCustomMessage("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSharingCustom(false);
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
              "Messages d’encouragement issus de tes fichiers de coaching + paramètres de réception."
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

      {/* Carte préférences jour/heure */}
      <div
        className="card"
        style={{
          padding: 10,
          marginBottom: 10,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {t(
                "motivation.preferences.title",
                "Préférences de notification"
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              {t(
                "motivation.preferences.subtitle",
                "Choisis les jours et l’heure à laquelle tu souhaites recevoir tes messages de motivation."
              )}
            </div>
          </div>
        </div>

        {/* Jours */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 4,
          }}
        >
          {ALL_DAYS.map((day) => {
            const active = activeDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
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
            {t(
              "motivation.preferences.timeLabel",
              "Heure préférée :"
            )}
          </label>
          <input
            type="time"
            value={prefTime}
            onChange={(e) => setPrefTime(e.target.value)}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            {t(
              "motivation.preferences.timeNote",
              "(Ces réglages sont pour l’instant stockés uniquement ici, côté client.)"
            )}
          </span>
        </div>
      </div>

      {/* Barre d’actions & infos */}
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
            {t("motivation.bar.youChose", "Tu as choisi :")}{" "}
            {activeDays.length === 0
              ? t("motivation.bar.noDays", "aucun jour")
              : activeDays.map((d) => getDayLabel(d)).join(", ")}{" "}
            {t("motivation.bar.at", "à")} {prefTime}.
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

      {/* Message motivant pour lui-même */}
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
            "motivation.selfMessage.title",
            "Ton message pour toi"
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          {t(
            "motivation.selfMessage.subtitle",
            "Écris un message que tu recevras en rappel motivant, selon les jours et l’heure choisis plus haut."
          )}
        </div>

        <textarea
          value={selfMessage}
          onChange={(e) => setSelfMessage(e.target.value)}
          rows={3}
          placeholder={t(
            "motivation.selfMessage.placeholder",
            "Ex : « Même 10 minutes aujourd’hui, c’est déjà une victoire. »"
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
            marginTop: 2,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            {t(
              "motivation.selfMessage.info",
              "Dans une prochaine version, ce message sera réellement envoyé en notif aux jours/horaires définis."
            )}
          </span>
          <button
            type="button"
            className="btn"
            onClick={saveSelfMessage}
            disabled={!selfMessage.trim() || savingSelf}
            style={{
              fontSize: 12,
              background: "#111827",
              color: "#ffffff",
              borderRadius: 999,
              padding: "6px 10px",
              opacity: !selfMessage.trim() || savingSelf ? 0.6 : 1,
              cursor:
                !selfMessage.trim() || savingSelf
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {savingSelf
              ? t(
                  "motivation.selfMessage.saving",
                  "Programmation en cours..."
                )
              : t(
                  "motivation.selfMessage.saveButton",
                  "Programmer ce message"
                )}
          </button>
        </div>
      </div>

      {/* Message motivant pour ses amis */}
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
            "motivation.customMessage.title",
            "Ton message pour motiver tes amis"
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          {t(
            "motivation.customMessage.subtitle",
            "Écris un mot d’encouragement qui sera partagé à tes amis qui utilisent l’appli (dans une future version connectée)."
          )}
        </div>

        <textarea
          value={customMessage}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= CUSTOM_MESSAGE_MAX) {
              setCustomMessage(value);
            }
          }}
          rows={3}
          placeholder={t(
            "motivation.customMessage.placeholder",
            "Ex : « On se bloque une séance ensemble cette semaine ? 💪 »"
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
            marginTop: 2,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            {t(
              "motivation.customMessage.info",
              "Dans une version future, ce message sera envoyé comme notif à tes amis."
            )}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: customRemaining < 0 ? "#b91c1c" : "#6b7280",
              }}
            >
              {customRemaining}{" "}
              {t(
                "motivation.customMessage.remaining",
                "caractères restants"
              )}
            </span>
            <button
              type="button"
              className="btn"
              onClick={shareCustomMessage}
              disabled={!customMessage.trim() || sharingCustom}
              style={{
                fontSize: 12,
                background: "#111827",
                color: "#ffffff",
                borderRadius: 999,
                padding: "6px 10px",
                opacity: !customMessage.trim() || sharingCustom ? 0.6 : 1,
                cursor:
                  !customMessage.trim() || sharingCustom
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {sharingCustom
                ? t(
                    "motivation.customMessage.sending",
                    "Partage en cours..."
                  )
                : t(
                    "motivation.customMessage.sendButton",
                    "Partager à mes amis"
                  )}
            </button>
          </div>
        </div>
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
              'Utilise le bouton “Envoyer une notif de test” pour tester l’affichage.'
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
