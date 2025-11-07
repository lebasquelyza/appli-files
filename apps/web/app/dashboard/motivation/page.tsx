"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type CoachingNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string; // ISO
  read: boolean;
  source?: string;   // ex: "Files Coaching"
  rating?: number;   // 0–5
};

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const SIDE_PADDING = 16;
const PAGE_MAX_WIDTH = 740;

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Lundi",
  tue: "Mardi",
  wed: "Mercredi",
  thu: "Jeudi",
  fri: "Vendredi",
  sat: "Samedi",
  sun: "Dimanche",
};

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

  const [notifications, setNotifications] = useState<CoachingNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [sending, setSending] = useState(false);

  // Préférences d’envoi
  const [activeDays, setActiveDays] = useState<DayKey[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);
  const [prefTime, setPrefTime] = useState("09:00");

  // 🔹 Notifs en dur pour l’instant (mock)
  useEffect(() => {
    setNotifications([
      {
        id: "1",
        title: "Tu progresses 💪",
        message:
          "Super séance hier ! Continue sur cette lancée, la régularité fait toute la différence.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        read: false,
        source: "Files Coaching",
      },
      {
        id: "2",
        title: "Rappel douceur",
        message:
          "Même une petite séance vaut mieux que rien. 10 minutes aujourd’hui, c’est déjà gagné.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        read: true,
        source: "Files Coaching",
        rating: 4,
      },
    ]);
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

  // ⭐ Noter une notification
  const setRating = (id: string, rating: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, rating } : n))
    );
  };

  // Toggle jour actif / inactif
  const toggleDay = (day: DayKey) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Simuler une “notification de motivation” reçue
  const sendTestNotification = async () => {
    if (sending) return;
    setSending(true);

    const samples: Array<Pick<CoachingNotification, "title" | "message">> = [
      {
        title: "On lâche rien 🔥",
        message:
          "Tu es plus proche de ton objectif aujourd’hui qu’hier. Une action de plus, même petite.",
      },
      {
        title: "Respire & avance",
        message:
          "Ne cherche pas la perfection. Cherche la progression. Un pas après l’autre.",
      },
      {
        title: "Tu peux le faire ✨",
        message:
          "Rappelle-toi pourquoi tu as commencé. Tu as déjà traversé plus dur que ça.",
      },
      {
        title: "Ton futur toi te remercie",
        message:
          "Chaque décision d’aujourd’hui construit la personne que tu seras dans 3 mois.",
      },
      {
        title: "Mini séance, maxi impact",
        message:
          "Si tu n’as pas le temps pour 30 minutes, fais-en 5. Ce qui compte, c’est le mouvement.",
      },
      {
        title: "Recommence autant que nécessaire",
        message:
          "Tomber fait partie du jeu. Ce qui compte, c’est à quelle vitesse tu te relèves.",
      },
      {
        title: "Tu n’es pas seul·e",
        message:
          "Demander de l’aide, c’est aussi une forme de force. Tu fais ça pour TOI.",
      },
      {
        title: "C’est ton moment",
        message:
          "Bloque 10 minutes rien que pour toi maintenant. Ton corps et ta tête te diront merci.",
      },
    ];

    const sample =
      samples[Math.floor(Math.random() * samples.length)];

    const nowIso = new Date().toISOString();

    setNotifications((prev) => [
      {
        id: nowIso,
        title: sample.title,
        message: sample.message,
        createdAt: nowIso,
        read: false,
        source: "Files Coaching (test)",
      },
      ...prev,
    ]);

    setTimeout(() => setSending(false), 400);
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
          Motivation
        </h1>
        <p className="lead" style={{ fontSize: 12, marginTop: 2 }}>
          Chargement…
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
            Motivation
          </h1>
          <p
            className="lead"
            style={{
              fontSize: 12,
              marginTop: 2,
              color: "#6b7280",
            }}
          >
            Messages d’encouragement issus de tes fichiers de coaching
            (mock pour l’instant) + paramètres de réception.
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
            Connecté en tant que {session.user?.email ?? "client"}
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
              Préférences de notification
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              Choisis les jours et l’heure à laquelle tu souhaites
              recevoir tes messages de motivation.
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
          {(Object.keys(DAY_LABELS) as DayKey[]).map((day) => {
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
                {DAY_LABELS[day]}
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
            Heure préférée :
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
            (Ces réglages sont pour l’instant stockés uniquement ici,
            côté client.)
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
          notification{unreadCount > 1 ? "s" : ""} non lue
          {unreadCount > 1 ? "s" : ""}.
          <br />
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            Tu as choisi :{" "}
            {activeDays.length === 0
              ? "aucun jour"
              : activeDays
                  .map((d) => DAY_LABELS[d])
                  .join(", ")}{" "}
            à {prefTime}.
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
              Tout
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
              Non lues
            </button>
          </div>

          <button
            type="button"
            className="btn btn-dash"
            style={{ fontSize: 12 }}
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            Tout marquer comme lu
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
            {sending ? "Envoi..." : "Envoyer une notif de test"}
          </button>
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
            Aucune notification à afficher pour le moment.
            <br />
            Utilise le bouton{" "}
            <strong>“Envoyer une notif de test”</strong> pour tester
            l’affichage.
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
                      Nouveau
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
                  Source : {n.source}
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

              {/* ⭐ Notation */}
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
                  Ta note :
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
                              ? "#facc15" // jaune
                              : "#d1d5db", // gris
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
                    Marquer comme lu
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
