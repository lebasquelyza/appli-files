// apps/web/app/dashboard/motivation/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { translations } from "@/app/i18n/translations";
import { enableWebPush } from "@/lib/pushClient";

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
  userId: string;
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

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch("/api/motivation/messages");
        if (!res.ok) return;
        const data: MotivationMessageApi[] = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const extra: CoachingNotification[] = data
            .filter((msg) => !existingIds.has(msg.id))
            .map((msg) => {
              const isMe = msg.target === "ME";
              const daysLabel = msg.days.split(",").filter(Boolean).join(", ");
              return {
                id: msg.id,
                title: isMe
                  ? t("motivation.selfNotification.title", "Programmation “Files Le Coach” ✅")
                  : t("motivation.customNotification.title", "Message programmé pour tes amis 💌"),
                message: isMe
                  ? t(
                      "motivation.selfNotification.bodyHint",
                      "Tu recevras une motivation de Files Le Coach aux jours/heures choisis."
                    )
                  : msg.content,
                createdAt: msg.createdAt,
                read: true,
                source: isMe
                  ? t("motivation.selfNotification.source", `Files Le Coach – ${daysLabel} à ${msg.time}`)
                  : t("motivation.customNotification.source", `Toi → amis – ${daysLabel} à ${msg.time}`),
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
    setScheduleDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

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
      const res = await fetch("/api/motivation/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: scheduleTarget,
          content: trimmed,
          days: scheduleDays,
          time: scheduleTime,
          recipientIds: scheduleTarget === "FRIENDS" ? selectedFriendIds : undefined,
        }),
      });

      if (!res.ok) {
        console.error("Error saving message", await res.json());
        return;
      }

      const msg: MotivationMessageApi = await res.json();
      const isMe = msg.target === "ME";
      const daysLabel = msg.days.split(",").filter(Boolean).join(", ");

      setNotifications((prev) => [
        {
          id: msg.id ?? `${isMe ? "self" : "custom"}-${Date.now()}`,
          title: isMe
            ? t("motivation.selfNotification.title", "Programmation “Files Le Coach” ✅")
            : t("motivation.customNotification.title", "Message programmé pour tes amis 💌"),
          message: isMe
            ? t(
                "motivation.selfNotification.bodyHint",
                "Tu recevras une motivation de Files Le Coach aux jours/heures choisis."
              )
            : trimmed,
          createdAt: msg.createdAt ?? new Date().toISOString(),
          read: true,
          source: isMe
            ? t("motivation.selfNotification.source", `Files Le Coach – ${daysLabel} à ${msg.time}`)
            : t("motivation.customNotification.source", `Toi → amis – ${daysLabel} à ${msg.time}`),
        },
        ...prev,
      ]);

      setMessage("");
      cancelSchedule();
    } catch (e) {
      console.error(e);
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
      await enableWebPush(VAPID_PUBLIC_KEY);
      alert("Notifications activées ✅");
    } catch (e: any) {
      console.error("[push] enable failed:", e);
      const msg = e?.message || String(e);
      alert(`Impossible d'activer les notifications:\n\n${msg}`);
    } finally {
      setPushBusy(false);
    }
  };

  // ✅ AJOUT: bouton test push serveur (dev)
  const sendServerPushTest = async () => {
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        alert(`Test push serveur échoué (${res.status})\n\n${txt}`);
        return;
      }
      const json = await res.json().catch(() => null);
      alert(`Test push serveur envoyé ✅\n\n${json ? JSON.stringify(json) : ""}`);
    } catch (e: any) {
      alert(`Test push serveur erreur:\n\n${e?.message || String(e)}`);
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
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 20, color: "#111827" }}>
            {t("motivation.pageTitle", "Motivation")}
          </h1>
          <p style={{ fontSize: 12, marginTop: 2, color: "#6b7280" }}>
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
            {session.user?.email ?? t("motivation.header.clientFallback", "client")}
          </div>
        )}
      </div>

      {/* Actions */}
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
          <strong>{unreadCount}</strong> {t("motivation.bar.unreadSuffix", "notification(s) non lue(s).")}
          <br />
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {t("motivation.bar.info", "Les programmations et notifications s’affichent ici.")}
          </span>
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
            {pushBusy ? "Activation..." : "Activer les notifications"}
          </button>

          {/* ✅ AJOUT */}
          <button
            type="button"
            className="btn btn-dash"
            style={{ fontSize: 12, borderRadius: 999, padding: "6px 10px" }}
            onClick={sendServerPushTest}
          >
            Test push serveur
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
              {t("motivation.bar.filterAll", "Tout")}
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
            {t("motivation.bar.markAllRead", "Tout marquer comme lu")}
          </button>

          <button
            type="button"
            className="btn"
            style={{ fontSize: 12, background: "#111827", color: "#ffffff", borderRadius: 999, padding: "6px 10px" }}
            onClick={sendTestNotification}
            disabled={sending}
          >
            {sending ? t("motivation.bar.sending", "Envoi...") : t("motivation.bar.sendTest", "Envoyer une notif de test")}
          </button>
        </div>
      </div>

      {/* Message block */}
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
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
          {t("motivation.messageBlock.title", "Crée ton message motivant")}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {t(
            "motivation.messageBlock.subtitle",
            "Pour “Programmer pour moi”, tu recevras un message de Files Le Coach. Pour “Partager à mes amis”, ton texte sera envoyé."
          )}
        </div>

        <textarea
          value={message}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= CUSTOM_MESSAGE_MAX) setMessage(value);
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {remaining} {t("motivation.messageBlock.remaining", "caractères restants")}
          </span>
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
              Partager à mes amis
            </button>
          </div>
        </div>

        {/* Step 2 */}
        {scheduleTarget && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
              {scheduleTarget === "ME"
                ? "Pour toi : choisis les jours et l’heure (Files Le Coach)"
                : "Pour tes amis : choisis les jours/heure et sélectionne les amis"}
            </div>

            {/* Days */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
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

            {/* Time */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: "#374151" }}>Heure :</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
            </div>

            {/* Friends selection */}
            {scheduleTarget === "FRIENDS" && (
              <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>Sélection des amis</div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input
                    value={friendQuery}
                    onChange={(e) => setFriendQuery(e.target.value)}
                    placeholder="Rechercher par email / nom (min 2 caractères)"
                    style={{
                      flex: 1,
                      minWidth: 240,
                      fontSize: 12,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-dash"
                    onClick={loadFriends}
                    disabled={loadingFriends}
                    style={{ fontSize: 12, borderRadius: 999, padding: "6px 10px" }}
                  >
                    {loadingFriends ? "Chargement..." : "Mes amis"}
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedFriendIds.length === 0 ? (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>Aucun ami sélectionné (obligatoire).</span>
                  ) : (
                    selectedFriendIds.map((id) => {
                      const u = friends.find((f) => f.id === id) || searchResults.find((s) => s.id === id);
                      const label = u?.name || u?.email || id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => removeSelected(id)}
                          style={{
                            borderRadius: 999,
                            border: "1px solid #e5e7eb",
                            padding: "4px 10px",
                            fontSize: 12,
                            background: "#111827",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                          title="Cliquer pour retirer"
                        >
                          {label} ✕
                        </button>
                      );
                    })
                  )}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Suggestions (tes amis acceptés)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {friends.length === 0 ? (
                      <span style={{ fontSize: 11, color: "#6b7280" }}>
                        Pas d’amis pour le moment. Cherche un utilisateur et envoie une demande dans l’onglet “Amis”.
                      </span>
                    ) : (
                      friends.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => addSelected(f.id)}
                          style={{
                            borderRadius: 999,
                            border: "1px solid #e5e7eb",
                            padding: "4px 10px",
                            fontSize: 12,
                            background: selectedFriendIds.includes(f.id) ? "#111827" : "#ffffff",
                            color: selectedFriendIds.includes(f.id) ? "#fff" : "#374151",
                            cursor: "pointer",
                          }}
                        >
                          {(f.name || f.email || f.id).toString()}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {searchResults.length > 0 && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Résultats recherche (utilisateurs)</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => addSelected(u.id)}
                          style={{
                            borderRadius: 999,
                            border: "1px solid #e5e7eb",
                            padding: "4px 10px",
                            fontSize: 12,
                            background: selectedFriendIds.includes(u.id) ? "#111827" : "#ffffff",
                            color: selectedFriendIds.includes(u.id) ? "#fff" : "#374151",
                            cursor: "pointer",
                          }}
                        >
                          {(u.name || u.email || u.id).toString()}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      Note : pour envoyer réellement, l’utilisateur doit être un ami accepté.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
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
                {savingSelf || sharingCustom ? "Enregistrement..." : "Valider"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notifications list */}
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
            Aucune notification à afficher.
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
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
                <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>{formatTime(n.createdAt)}</div>
              </div>

              {n.source && <div style={{ fontSize: 11, color: "#6b7280" }}>Source : {n.source}</div>}

              <p style={{ fontSize: 13, color: "#374151", marginTop: 2, marginBottom: 4 }}>{n.message}</p>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#6b7280", marginRight: 2 }}>Ta note :</span>
                <div>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(n.id, star)}
                      style={{ background: "transparent", border: "none", padding: 0, margin: "0 1px", cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 16, color: star <= (n.rating ?? 0) ? "#facc15" : "#d1d5db" }}>★</span>
                    </button>
                  ))}
                </div>
                {typeof n.rating === "number" && <span style={{ fontSize: 11, color: "#6b7280" }}>({n.rating}/5)</span>}
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
