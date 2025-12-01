"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { getSessionClient } from "@/lib/session-client"; // ⚠️ Ajout simple pour les sessions côté client

type KcalStore = Record<string, number>;
type Workout = { status: "active" | "done"; startedAt?: string; endedAt?: string };
type Store = { sessions: Workout[] };

function parseKcalStore(raw?: string): KcalStore {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}
function parseSessions(raw?: string): Store {
  try {
    const o = JSON.parse(raw || "{}");
    return { sessions: Array.isArray(o?.sessions) ? o.sessions : [] };
  } catch { return { sessions: [] }; }
}

function todayISO(tz = "Europe/Paris") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export default function DashboardPage() {
  const { t, lang } = useLanguage();

  // Lecture cookies côté client
  const kcals = parseKcalStore(typeof document !== "undefined" ? document.cookie.match(/app.kcals=([^;]+)/)?.[1] : "{}");
  const sessions = parseSessions(typeof document !== "undefined" ? document.cookie.match(/app_sessions=([^;]+)/)?.[1] : "{}");

  const today = todayISO();
  const todayKcal = kcals[today] || 0;

  const stepsToday = sessions.sessions.filter((x) => x.status === "active").length;

  const lastDone = sessions.sessions
    .filter((x) => x.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""))[0];

  const lastSessionDate =
    lastDone?.endedAt
      ? new Date(lastDone.endedAt).toLocaleDateString(lang === "en" ? "en-US" : "fr-FR")
      : "—";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      {/* HEADER */}
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

      {/* KPIs */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("dashboard.kpi.calories")}
          value={`${todayKcal.toLocaleString(lang === "en" ? "en-US" : "fr-FR")} kcal`}
          href="/dashboard/calories"
          manageLabel={t("dashboard.kpi.manage")}
        />
        <KpiCard
          title={t("dashboard.kpi.steps")}
          value={`${stepsToday}`}
          href="/dashboard/progress"
          manageLabel={t("dashboard.kpi.manage")}
        />
        <KpiCard
          title={t("dashboard.kpi.lastSession")}
          value={lastSessionDate}
          href="/dashboard/profile"
          manageLabel={t("dashboard.kpi.manage")}
        />
      </section>

      {/* QUICK ACTIONS */}
      <section className="grid gap-6 lg:grid-cols-2" style={{ marginTop: 12 }}>
        <article className="card">
          <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>
            {t("dashboard.quick.calories.title")}
          </h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
            {t("dashboard.quick.calories.text")}
          </p>
          <div style={{ marginTop: 10 }}>
            <Link href="/dashboard/calories" className="btn btn-dash" style={{ padding: "8px 12px", fontWeight: 700 }}>
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
            <Link href="/dashboard/profile" className="btn btn-dash" style={{ padding: "8px 12px", fontWeight: 700 }}>
              {t("dashboard.quick.workouts.button")}
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

/* COMPONENT KPI CARD */
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
