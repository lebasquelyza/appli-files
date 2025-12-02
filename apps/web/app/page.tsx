// apps/web/app/page.tsx
"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export default function HomePage() {
  const { lang, setLang, t } = useLanguage();

  // petit helper avec fallback
  const tf = (path: string, fallback?: string) => {
    const v = t(path);
    if (v && v !== path) return v;
    return fallback ?? path;
  };

  return (
    <main
      className="min-h-screen"
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Barre du haut avec logo + switch langue */}
      <header
        className="w-full border-b border-gray-200"
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            Files Coaching
          </span>
        </div>

        {/* Switch FR / EN */}
        <div className="inline-flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setLang("fr")}
            className={
              lang === "fr"
                ? "px-2 py-1 rounded-md border border-neutral-900 bg-neutral-900 text-white font-semibold"
                : "px-2 py-1 rounded-md border border-neutral-300 bg-white text-neutral-900"
            }
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={
              lang === "en"
                ? "px-2 py-1 rounded-md border border-neutral-900 bg-neutral-900 text-white font-semibold"
                : "px-2 py-1 rounded-md border border-neutral-300 bg-white text-neutral-900"
            }
          >
            EN
          </button>
        </div>
      </header>

      {/* Contenu principal */}
      <div
        className="container mx-auto"
        style={{
          flex: 1,
          padding: "32px 16px 40px",
          maxWidth: 960,
        }}
      >
        {/* Hero */}
        <section
          className="grid gap-10 md:grid-cols-2 items-center"
        >
          <div>
            <p className="text-sm font-medium text-emerald-600 mb-2">
              {tf("home.hero.titleLine1", "Files Coaching —")}
            </p>
            <h1
              className="font-bold"
              style={{
                fontSize: 32,
                lineHeight: 1.1,
                color: "#111827",
              }}
            >
              {tf("home.hero.titleLine2", "Coach Sportif IA")}
            </h1>
            <p
              className="mt-3 text-sm"
              style={{ color: "#4b5563" }}
            >
              {tf(
                "home.hero.subtitle",
                "Séances personnalisées, conseils et suivi"
              )}
            </p>

            {/* Bullets */}
            <ul
              className="mt-4 space-y-1 text-sm"
              style={{ color: "#111827" }}
            >
              <li>
                {tf(
                  "home.hero.bullets.program",
                  "✅ Programme personnalisé adapté à vos objectifs"
                )}
              </li>
              <li>
                {tf(
                  "home.hero.bullets.timerMusic",
                  "✅ Minuteur & Musique intégrés pour vos séances"
                )}
              </li>
              <li>
                {tf(
                  "home.hero.bullets.recipes",
                  "✅ Recettes healthy & conseils nutrition"
                )}
              </li>
            </ul>

            {/* CTA */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {tf("home.cta.login", "Connecte-toi")}
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
              >
                {tf(
                  "home.cta.signup",
                  "Créer un compte"
                )}
              </Link>
            </div>
          </div>

          {/* Petit bloc visuel à droite (simple placeholder) */}
          <div className="hidden md:block">
            <div
              className="rounded-2xl border border-gray-200 shadow-sm p-4"
              style={{ background: "#f9fafb" }}
            >
              <p
                className="text-xs font-semibold text-emerald-600"
                style={{ marginBottom: 4 }}
              >
                Files Coaching
              </p>
              <p
                className="text-sm"
                style={{ color: "#374151", marginBottom: 8 }}
              >
                {lang === "fr"
                  ? "Un espace unique pour tes séances, ta musique, tes recettes et ton suivi."
                  : "One place for your workouts, music, recipes and tracking."}
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-white border border-gray-200 p-3">
                  <p className="font-semibold mb-1">
                    {lang === "fr"
                      ? "Séances IA"
                      : "AI sessions"}
                  </p>
                  <p className="text-gray-500">
                    {lang === "fr"
                      ? "Programme adapté à tes réponses."
                      : "Program tailored to your answers."}
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-gray-200 p-3">
                  <p className="font-semibold mb-1">
                    {lang === "fr"
                      ? "Calories & recettes"
                      : "Calories & recipes"}
                  </p>
                  <p className="text-gray-500">
                    {lang === "fr"
                      ? "Historique + base healthy."
                      : "History + healthy base."}
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-gray-200 p-3">
                  <p className="font-semibold mb-1">
                    {lang === "fr"
                      ? "Musique & minuteur"
                      : "Music & timer"}
                  </p>
                  <p className="text-gray-500">
                    {lang === "fr"
                      ? "Timer simple, Tabata, Spotify."
                      : "Simple timer, Tabata, Spotify."}
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-gray-200 p-3">
                  <p className="font-semibold mb-1">
                    {lang === "fr"
                      ? "Motivation"
                      : "Motivation"}
                  </p>
                  <p className="text-gray-500">
                    {lang === "fr"
                      ? "Messages d’encouragement."
                      : "Motivational messages."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
