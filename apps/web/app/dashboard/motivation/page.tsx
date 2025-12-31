// apps/web/app/dashboard/motivation/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { translations } from "@/app/i18n/translations";
import { enableWebPush, getDeviceId } from "@/lib/pushClient";

/* ---------------- i18n helpers (client) ---------------- */
type Lang = "fr" | "en";

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function getLangClient(): Lang {
  if (typeof document === "undefined") return "fr";
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
  source?: string;
  rating?: number; // 0–5
};

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type MotivationMessageApi = {
  id: string;
  userId?: string | null;
  device_id?: string | null;
  target: string; // "ME" | "FRIENDS"
  mode?: string; // "COACH" | "CUSTOM"
  content: string;
  days: string; // "mon,tue,wed"
  time: string; // "HH:mm"
  active: boolean;
  createdAt: string;
  updatedAt: string;
  recipients?: Array<{ recipientUserId: string }>;
};

type FriendUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

const SIDE_PADDING = 16;
const PAGE_MAX_WIDTH = 740;
const ALL_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
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

function formatDaysFr(daysCsv: string) {
  const map: Record<string, string> = {
    mon: "Lun",
    tue: "Mar",
    wed: "Mer",
    thu: "Jeu",
    fri: "Ven",
    sat: "Sam",
    sun: "Dim",
  };
  return String(daysCsv || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => map[d] || d)
    .join(", ");
}

export default function MotivationPage() {
  const { data: session, status } = useSession();
  const t = useT();

  const [notifications, setNotifications] = useState<CoachingNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [sending, setSending] = useState(false);

  const [message, setMessage] = useState("");
  const remaining = CUSTOM_MESSAGE_MAX - message.length;

  const [scheduleTarget, setScheduleTarget] = useState<null | "ME" | "FRIENDS">(null);
  const [scheduleDays, setScheduleDays] = useState<DayKey[]>([]);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [savingSelf, setSavingSelf] = useState(false);
  const [sharingCustom, setSharingCustom] = useState(false);

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [friendQuery, setFriendQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const [pushBusy, setPushBusy] = useState(false);
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  // ✅ Programmations (déroulable)
  const [scheduledMessages, setScheduledMessages] = useState<MotivationMessageApi[]>([]);

  useEffect(() => {
    // 👇 On garde tes 2 mocks mais sans bruit inutile (ils servent juste à remplir l’écran)
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
        rating: 4,
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch("/api/motivation/messages", { credentials: "include" });
        if (!res.ok) return;
        const data: MotivationMessageApi[] = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        setScheduledMessages(data);

        // garde ton comportement: injecter les programmations dans l'historique
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const extra: CoachingNotification[] = data
            .filter((msg) => !existingIds.has(msg.id))
            .map((msg) => {
              const isMe = msg.target === "ME";
              return {
                id: msg.id,
                title: isMe ? "Programmation ✅" : "Message programmé 💌",
                message: isMe ? "Files Le Coach t’enverra une motivation." : msg.content,
                createdAt: msg.createdAt,
                read: true,
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
    () => (filter === "all" ? notifications : notifications.filter((n) => !n.read)),
    [notifications, filter]
  );

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const setRating = (id: string, rating: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, rating } : n)));
  };

  const getDayLabel = (day: DayKey) =>
    t(
      `motivation.dayLabels.${day}`,
      {
        mon: "Lun",
        tue: "Mar",
        wed: "Mer",
        thu: "Jeu",
        fri: "Ven",
        sat: "Sam",
        sun: "Dim",
      }[day]
    );

  const toggleScheduleDay = (day: DayKey) => {
    setScheduleDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  // ⚠️ logique conservée (même si non utilisée par un bouton)
  const sendTestNotification = async () => {
    if (sending) return;
    setSending(true);

    const samples: Array<{ title: string; message: string }> = [
      { title: "On lâche rien 🔥", message: "Tu avances. Une action de plus, même petite." },
      { title: "Respire & avance", message: "La progression, pas la perfection." },
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
      },
      ...prev,
    ]);

    setTimeout(() => setSending(false), 400);
  };

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await fetch("/api/friends/list");
      const data: FriendUser[] = res.ok ? await res.json() : [];
      setFriends(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      const q = friendQuery.trim();
      if (q.length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data: FriendUser[] = res.ok ? await res.json() : [];
        if (!cancelled) setSearchResults(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setSearchResults([]);
      }
    }

    const tmr = setTimeout(runSearch, 250);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [friendQuery]);

  const openSchedule = async (target: "ME" | "FRIENDS") => {
    if (!message.trim() && target === "FRIENDS") return;
    setScheduleTarget(target);
    setScheduleDays((prev) => (prev.length > 0 ? prev : ["mon", "tue", "wed", "thu", "fri"]));

    if (target === "FRIENDS") {
      setSelectedFriendIds([]);
      await loadFriends();
    }
  };

  const cancelSchedule = () => {
    setScheduleTarget(null);
    setScheduleDays([]);
    setFriendQuery("");
    setSearchResults([]);
    setSelectedFriendIds([]);
  };

  const addSelected = (id: string) => {
    setSelectedFriendIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeSelected = (id: string) => {
    setSelectedFriendIds((prev) => prev.filter((x) => x !== id));
  };

  const confirmSchedule = async () => {
    const trimmed = message.trim();
    if (!scheduleTarget) return;
    if (scheduleDays.length === 0) return;

    if (scheduleTarget === "ME") setSavingSelf(true);
    if (scheduleTarget === "FRIENDS") setSharingCustom(true);

    try {
      const deviceId = getDeviceId();

      const res = await fetch("/api/motivation/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          target: scheduleTarget,
          content: trimmed,
          days: scheduleDays,
          time: scheduleTime,
          recipientIds: scheduleTarget === "FRIENDS" ? selectedFriendIds : undefined,
          deviceId,
        }),
      });

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        alert(`Erreur API (${res.status})\n\n${text}`);
        return;
      }

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      const msg: MotivationMessageApi = (json as MotivationMessageApi) ?? ({} as any);

      setScheduledMessages((prev) => [msg, ...prev]);

      const isMe = msg.target === "ME";
      setNotifications((prev) => [
        {
          id: msg.id ?? `${isMe ? "self" : "custom"}-${Date.now()}`,
          title: isMe ? "Programmation ✅" : "Message programmé 💌",
          message: isMe ? "Files Le Coach t’enverra une motivation." : trimmed,
          createdAt: msg.createdAt ?? new Date().toISOString(),
          read: true,
        },
        ...prev,
      ]);

      setMessage("");
      cancelSchedule();
    } catch (e: any) {
      alert(`Erreur réseau\n\n${e?.message || String(e)}`);
    } finally {
      if (scheduleTarget === "ME") setSavingSelf(false);
      if (scheduleTarget === "FRIENDS") setSharingCustom(false);
    }
  };

  const canConfirm =
    scheduleDays.length > 0 &&
    !!scheduleTime &&
    !savingSelf &&
    !sharingCustom &&
    (scheduleTarget === "ME" ||
      (scheduleTarget === "FRIENDS" && !!message.trim() && selectedFriendIds.length > 0));

  const activatePush = async () => {
    if (!VAPID_PUBLIC_KEY) {
      alert("NEXT_PUBLIC_VAPID_PUBLIC_KEY manquant (à configurer dans Netlify)");
      return;
    }

    setPushBusy(true);
    try {
      await enableWebPush(VAPID_PUBLIC_KEY, "motivation");
      alert("Notifications activées ✅");
    } catch (e: any) {
      console.error("[push] enable failed:", e);
      const msg = e?.message || String(e);
      alert(`Impossible d'activer les notifications:\n\n${msg}`);
    } finally {
      setPushBusy(false);
    }
  };

  const sendServerPushTest = async () => {
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        alert(`Notification test échouée (${res.status})\n\n${txt}`);
        return;
      }
      alert("Notification test envoyée ✅");
    } catch (e: any) {
      alert(`Notification test erreur:\n\n${e?.message || String(e)}`);
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
      </div>
    );
  }

  const scheduledCount = scheduledMessages.filter((m) => m.active).length;

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
      {/* Header (minimal) */}
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>
          {t("motivation.pageTitle", "Motivation")}
        </h1>

        {/* badge minimal si connecté */}
        {session?.user?.email && (
          <div style={{ fontSize: 11, color: "#6b7280" }}>{session.user.email}</div>
        )}
      </div>

      {/* Programmations déroulables (minimal) */}
      <details
        className="card"
        style={{
          padding: 10,
          marginBottom: 10,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 12,
        }}
      >
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#111827" }}>
          📅 Programmations ({scheduledCount})
        </summary>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {scheduledMessages.filter((m) => m.active).length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>Aucune programmation.</div>
          ) : (
            scheduledMessages
              .filter((m) => m.active)
              .slice(0, 50)
              .map((m) => {
                const isMe = m.target === "ME";
                return (
                  <div
                    key={m.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      background: "#f9fafb",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                        {isMe ? "Pour moi" : "Pour mes amis"}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{formatDaysFr(m.days)}</div>
                    </div>

                    <div style={{ fontSize: 12, color: "#111827", whiteSpace: "nowrap", fontWeight: 700 }}>
                      {m.time}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </details>

      {/* Actions (minimal) */}
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
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {unreadCount > 0 ? `${unreadCount} non lue(s)` : "Tout est lu"}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            style={{
              fontSize: 12,
              background: "#111827",
              color: "#ffffff",
              borderRadius: 999,
              padding: "6px 10px",
              opacity: pushBusy ? 0.7 : 1,
            }}
            onClick={activatePush}
            disabled={pushBusy}
          >
            {pushBusy ? "Activation..." : "Activer"}
          </button>

          <button
            type="button"
            className="btn btn-dash"
            style={{ fontSize: 12, borderRadius: 999, padding: "6px 10px" }}
            onClick={sendServerPushTest}
          >
            Notification test
          </button>

          <div style={{ display: "inline-flex", borderRadius: 999, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setFilter("all")}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                border: "none",
                background: filter === "all" ? "#111827" : "transparent",
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
                background: filter === "unread" ? "#111827" : "transparent",
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
            Tout lire
          </button>
        </div>
      </div>

      {/* Composer (minimal) */}
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
        <textarea
          value={message}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= CUSTOM_MESSAGE_MAX) setMessage(value);
          }}
          rows={3}
          placeholder="Ton message (pour amis)"
          style={{
            width: "100%",
            fontSize: 13,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            resize: "vertical",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: remaining < 0 ? "#dc2626" : "#6b7280" }}>{remaining}</span>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-dash"
              onClick={() => openSchedule("ME")}
              style={{ fontSize: 12, borderRadius: 999, padding: "6px 10px" }}
            >
              Programmer pour moi
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
              Partager
            </button>
          </div>
        </div>

        {/* Step 2 (compact) */}
        {scheduleTarget && (
          <div style={{ paddingTop: 8, borderTop: "1px solid #e5e7eb", display: "grid", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />

              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-dash"
                  onClick={cancelSchedule}
                  style={{ fontSize: 12, borderRadius: 999, padding: "6px 10px" }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={confirmSchedule}
                  disabled={!canConfirm}
                  style={{
                    fontSize: 12,
                    background: "#111827",
                    color: "#ffffff",
                    borderRadius: 999,
                    padding: "6px 10px",
                    opacity: canConfirm ? 1 : 0.6,
                    cursor: canConfirm ? "pointer" : "not-allowed",
                  }}
                >
                  {savingSelf || sharingCustom ? "..." : "Valider"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notifications list (minimal) */}
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
            Rien à afficher.
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
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{n.title}</div>
                <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>{formatTime(n.createdAt)}</div>
              </div>

              <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{n.message}</p>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(n.id, star)}
                    style={{ background: "transparent", border: "none", padding: 0, margin: "0 1px", cursor: "pointer" }}
                    aria-label={`Note ${star}`}
                    title={`${star}`}
                  >
                    <span style={{ fontSize: 16, color: star <= (n.rating ?? 0) ? "#facc15" : "#d1d5db" }}>★</span>
                  </button>
                ))}

                {!n.read && (
                  <button
                    type="button"
                    className="btn btn-dash"
                    style={{ fontSize: 12, padding: "4px 8px", marginLeft: "auto" }}
                    onClick={() => markAsRead(n.id)}
                  >
                    Lire
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
