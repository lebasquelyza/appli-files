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
  const match = document.cookie.match(/(?:^|; )fc-lang=([^;]+)/);
  const val = match?.[1];
  if (val === "en") return "en";
  return "fr";
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
  const [loadingFromApi, setLoadingFromApi] = useState(true);

  // Préférences d’envoi (toujours côté client pour le moment)
  const [activeDays, setActiveDays] = useState<DayKey[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);
  const [prefTime, setPrefTime] = useState("09:00");

  /* -------- 1) Charger les vraies notifications depuis l’API -------- */

  useEffect(() => {
    // pas de session → on peut éventuellement garder les mocks
    if (!session?.user?.email) {
      setLoadingFromApi(false);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch("/api/motivation/notifications", {
          method: "GET",
        });
        if (!res.ok) throw new Error("Erreur API");
        const data = (await res.json()) as CoachingNotification[];
        setNotifications(data);
      } catch (err) {
        console.error("Erreur fetch notifications:", err);
        // fallback : rien, ou on pourrait mettre un message
      } finally {
        setLoadingFromApi(false);
      }
    };

    load();
  }, [session?.user?.email]);

  /* -------- 2) (Optionnel) Mocks si pas connecté / dev -------- */

  useEffect(() => {
    // Si on a déjà chargé depuis l’API, on ne met PAS les mocks
    if (!loadingFromApi || notifications.length > 0) return;

    // Si pas de session (ou en dev), on garde ton comportement actuel
    if (!session?.user?.email) {
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
      setLoadingFromApi(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingFromApi, session?.user?.email]);

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

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    // on notifie le backend (best effort)
    try {
      await fetch(`/api/motivation/notifications/${id}/read`, {
        method: "POST",
      });
    } catch (e) {
      console.error("markAsRead API error:", e);
    }
  };

  const markAllAsRead = async () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await fetch(`/api/motivation/notifications/mark-all-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch (e) {
      console.error("markAllAsRead API error:", e);
    }
  };

  // ⭐ Noter une notification
  const setRating = async (id: string, rating: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, rating } : n))
    );

    try {
      await fetch(`/api/motivation/notifications/${id}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch (e) {
      console.error("setRating API error:", e);
    }
  };

  // Toggle jour actif / inactif (toujours local pour l’instant)
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

  // 👉 Envoyer une vraie notif de test via le backend
  const sendTestNotification = async () => {
    if (sending) return;
    setSending(true);

    try {
      const res = await fetch("/api/motivation/notifications/test", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur envoi test");
      const created = (await res.json()) as CoachingNotification;

      // on ajoute en tête de liste
      setNotifications((prev) => [created, ...prev]);
    } catch (e) {
      console.error("sendTestNotification error:", e);
    } finally {
      setSending(false);
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
            {t(
              "motivation.header.connectedAs",
              "Connecté en tant que"
            )}{" "}
            {session.user?.email ??
              t("motivation.header.clientFallback", "client")}
          </div>
        )}
      </div>

      {/* Carte préférences jour/heure */}
      {/* ... (toute la partie préférences & liste reste identique à ton code) ... */}
      {/* Je n’ai changé que la source des données, pas l’UI. */}
      {/* 👉 Tu peux garder tout le reste tel quel à partir d’ici, c’est compatible. */}

      {/* (je raccourcis ici pour ne pas tout réécrire, mais ton code après ce point reste le même) */}
      {/* Colle juste la partie modifiée au-dessus (state + fetch + sendTestNotification) */}
    </div>
  );
}
