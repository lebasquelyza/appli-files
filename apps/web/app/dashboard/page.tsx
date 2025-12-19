///apps/web/app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

type KcalStore = Record<string, number>;

// ✅ CHANGED: on ajoute title (car syncDoneSessionsToCookie envoie title)
type Workout = {
  status: "active" | "done";
  startedAt?: string;
  endedAt?: string;
  title?: string;
  type?: string;
  sessionId?: string;
};

type Store = { sessions: Workout[] };

function parseKcalStore(raw?: string): KcalStore {
  try {
    const data = JSON.parse(raw || "{}") || {};
    return data && typeof data === "object" ? (data as KcalStore) : {};
  } catch {
    return {};
  }
}
function parseSessions(raw?: string): Store {
  try {
    const o = JSON.parse(raw || "{}");
    return { sessions: Array.isArray(o?.sessions) ? o.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}

const TZ = "Europe/Paris";

function todayISO(tz = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function toISODateInTZ(dateIsoString: string, tz = TZ): string {
  const d = new Date(dateIsoString);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

function readCookieValue(name: string): string {
  if (typeof document === "undefined") return "";
  const safe = name.replace(/\./g, "\\.");
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${safe}=([^;]+)`));
  return m ? m[1] : "";
}

function readKcalsCookie(): KcalStore {
  const raw = readCookieValue("app.kcals");
  return parseKcalStore(raw ? decodeURIComponent(raw) : "{}");
}

function readSessionsCookie(): Store {
  const raw = readCookieValue("app_sessions");
  return parseSessions(raw ? decodeURIComponent(raw) : "{}");
}

export default function DashboardPage() {
  const { t, lang } = useLanguage();

  const [kcals, setKcals] = useState<KcalStore>({});
  const [sessions, setSessions] = useState<Store>({ sessions: [] });

  useEffect(() => {
    const update = () => {
      setKcals(readKcalsCookie());
      setSessions(readSessionsCookie());
    };

    update();
    window.addEventListener("app:kcal-updated", update as any);
    window.addEventListener("app:sessions-updated", update as any);

    return () => {
      window.removeEventListener("app:kcal-updated", update as any);
      window.removeEventListener("app:sessions-updated", update as any);
    };
  }, []);

  const today = todayISO(TZ);
  const todayKcal = kcals[today] || 0;

  // ✅ Séances faites aujourd’hui (status done + endedAt aujourd’hui)
  const workoutsDoneToday = useMemo(() => {
    return sessions.sessions.filter((x) => {
      if (x.status !== "done") return false;
      if (!x.endedAt) return false;
      return toISODateInTZ(x.endedAt, TZ) === today;
    }).length;
  }, [sessions, today]);

  // ✅ Dernière séance terminée + index (pour lien détail)
  const lastDoneInfo = useMemo(() => {
    const doneWithIndex = sessions.sessions
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.status === "done" && !!s.endedAt)
      .sort((a, b) => (b.s.endedAt || "").localeCompare(a.s.endedAt || ""));
    return doneWithIndex[0] || null;
  }, [sessions]);

  // ✅ CHANGED: afficher le nom complet de la séance (title) au lieu de "Détail/Details"
  const lastSessionValue = lastDoneInfo
    ? (lastDoneInfo.s.title?.trim() ||
        (lang === "en" ? "Details" : "Détail"))
    : "—";

  // ✅ CHANGED: lien vers la page détail /dashboard/seance/[id] + from=home
  const lastSessionHref = lastDoneInfo
    ? `/dashboard/seance/${encodeURIComponent(
        lastDoneInfo.s.endedAt || lastDoneInfo.s.startedAt || String(lastDoneInfo.i)
      )}?from=home`
    : "/dashboard/profile";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>
            {t("dashboard.header.title")}
          </h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            {t("dashboard.header.subtitle")}
          </p>
        </div>
      </div>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title={t("dashboard.kpi.calories")}
          value={`${todayKcal.toLocaleString(lang === "en" ? "en-US" : "fr-FR")} kcal`}
          href="/dashboard/calories"
          manageLabel={t("dashboard.kpi.manage")}
        />

        <KpiCard
          title={lang === "en" ? "Workouts done (today)" : "Séances faites (aujourd’hui)"}
          value={`${workoutsDoneToday}`}
          href="/dashboard/profile"
          manageLabel={t("dashboard.kpi.manage")}
        />

        <KpiCard
          title={t("dashboard.kpi.lastSession")}
          value={lastSessionValue}
          href={lastSessionHref}
          manageLabel={t("dashboard.kpi.manage")}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2" style={{ marginTop: 12 }}>
        <article className="card">
          <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>
            {t("dashboard.quick.calories.title")}
          </h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
            {t("dashboard.quick.calories.text")}
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/dashboard/calories"
              className="btn btn-dash"
              style={{ padding: "8px 12px", fontWeight: 700 }}
            >
              {t("dashboard.quick.calories.button")}
            </Link>
          </div>
        </article>

        <article className="card">
          <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>
            {t("dashboard.quick.workouts.title")}
          </h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
            {t("dashboard.quick.workouts.text")}
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/dashboard/profile"
              className="btn btn-dash"
              style={{ padding: "8px 12px", fontWeight: 700 }}
            >
              {t("dashboard.quick.workouts.button")}
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  href,
  manageLabel,
}: {
  title: string;
  value: string;
  href: string;
  manageLabel?: string;
}) {
  return (
    <article className="card" style={{ cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p className="text-xs" style={{ color: "#111827", margin: 0 }}>{title}</p>
        {manageLabel && (
          <Link
            href={href}
            className="inline-flex items-center"
            style={{
              background: "#059669",
              color: "#ffffff",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {manageLabel}
          </Link>
        )}
      </div>

      <Link href={href}>
        <div style={{ marginTop: 8 }}>
          <strong style={{ fontSize: 20, lineHeight: 1, color: "#111827" }}>
            {value}
          </strong>
        </div>
      </Link>
    </article>
  );
}
