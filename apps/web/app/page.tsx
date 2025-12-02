"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getSupabase } from "../lib/supabaseClient";
import { useLanguage } from "@/components/LanguageProvider"; // ⬅️ traduction

// --- helper cookie (lisible serveur + client) ---
function setAppEmailCookie(val: string) {
  try {
    const isHttps =
      typeof window !== "undefined" &&
      window.location.protocol === "https:";
    document.cookie = [
      `app_email=${encodeURIComponent(val)}`,
      "Path=/",
      "SameSite=Lax",
      isHttps ? "Secure" : "",
      "Max-Age=31536000",
    ]
      .filter(Boolean)
      .join("; ");
  } catch {}
}

// --- helper pour notifier le backend d'un login / signup ---
async function notifyAuthEvent(type: "login" | "signup", userEmail: string) {
  try {
    await fetch("/api/notify-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, userEmail }),
    });
  } catch (err) {
    console.error("notifyAuthEvent error:", err);
  }
}

export default function HomePage() {
  // UI
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [inputsReady, setInputsReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordSignup, setShowPasswordSignup] = useState(false);

  // Auth (login)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Auth (signup)
  const [emailSu, setEmailSu] = useState("");
  const [passwordSu, setPasswordSu] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ⬅️ Traduction
  const { t, language, setLanguage } = useLanguage();

  function changeLang(lang: "en" | "fr") {
    if (lang !== language) setLanguage(lang);
  }

  useEffect(() => {
    const tmo = setTimeout(() => {
      setInputsReady(true);
      if (typeof document !== "undefined") {
        document.activeElement instanceof HTMLElement &&
          document.activeElement.blur();
      }
    }, 300);
    return () => clearTimeout(tmo);
  }, []);

  // sync cookie if logged
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const currentEmail = user?.email?.trim().toLowerCase();
        if (currentEmail) setAppEmailCookie(currentEmail);
      } catch {}
    })();
  }, []);

  // Track landing view
  async function trackPageView(emailValue?: string) {
    try {
      await fetch("/api/track-page-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path:
            typeof window !== "undefined"
              ? window.location.pathname
              : "/",
          email: emailValue || null,
        }),
      });
    } catch (err) {
      console.error("trackPageView error:", err);
    }
  }

  useEffect(() => {
    trackPageView();
  }, []);

  async function trackLoginPageView(emailValue?: string) {
    try {
      await fetch("/api/track-login-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path:
            typeof window !== "undefined"
              ? window.location.pathname
              : "/",
          email: emailValue || null,
        }),
      });
    } catch (err) {
      console.error("trackLoginPageView error:", err);
    }
  }

  function openLogin() {
    setShowLogin((v) => {
      const next = !v;
      if (next) {
        setShowSignup(false);
        const emailTrim = email.trim().toLowerCase();
        trackLoginPageView(emailTrim || undefined);
      }
      return next;
    });
    setMessage(null);
    setError(null);
  }

  function openSignup() {
    setShowSignup((v) => {
      const next = !v;
      if (next) setShowLogin(false);
      return next;
    });
    setMessage(null);
    setError(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = getSupabase();
      const emailTrim = email.trim().toLowerCase();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: password.trim(),
      });
      if (signInError) throw signInError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const sessionEmail = (user?.email || emailTrim)
        .trim()
        .toLowerCase();
      if (sessionEmail) {
        setAppEmailCookie(sessionEmail);
        await notifyAuthEvent("login", sessionEmail);
      }

      setMessage(t("home.login.success"));
      window.location.href = "/dashboard";
    } catch (err: any) {
      const msg = String(err?.message || "");
      setError(
        msg.toLowerCase().includes("invalid login credentials")
          ? t("home.login.error.invalidCredentials")
          : t("home.login.error.generic")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = getSupabase();
      const emailTrim = emailSu.trim().toLowerCase();
      const pwd = passwordSu.trim();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailTrim,
        password: pwd,
        options: {
          emailRedirectTo: `${window.location.origin}/callback?source=confirm`,
        },
      });

      if (signUpError) throw signUpError;

      if (emailTrim) setAppEmailCookie(emailTrim);

      if (data?.session) {
        await supabase.auth.signOut();
      }

      await notifyAuthEvent("signup", emailTrim);

      setMessage(t("home.signup.success"));
      setShowSignup(false);
      setShowLogin(true);
      setEmail(emailTrim);
    } catch (err: any) {
      const msg = String(err?.message || "");
      setError(
        /email|courriel/i.test(msg)
          ? t("home.signup.error.invalidEmail")
          : t("home.signup.error.generic")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setError(t("home.forgotPassword.noEmail"));
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailTrim,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );
      if (error) throw error;

      setMessage(t("home.forgotPassword.success"));
    } catch (err: any) {
      setError(err.message || t("home.forgotPassword.error"));
    } finally {
      setLoading(false);
    }
  }

  /** Style "pill" */
  const pillClass =
    "inline-flex items-center justify-center font-semibold shadow px-3 py-1.5 select-none active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 leading-none";
  const pillStyle: React.CSSProperties = {
    background: "linear-gradient(90deg,#22c55e,#16a34a)",
    color: "#fff",
    textDecoration: "none",
    borderRadius: 9999,
    whiteSpace: "nowrap",
  };

  return (
    <main className="hide-topbar-menu pt-10 sm:pt-12 pb-12">
      <div className="container max-w-screen-lg mx-auto px-4">

        {/* ---- HEADER avec le switch EN/FR ---- */}
        <header className="mb-0 flex items-start justify-between gap-4">
          <h1
            className="font-bold leading-tight not-prose
                       [font-size:theme(fontSize.3xl)!important]
                       sm:[font-size:theme(fontSize.5xl)!important]"
          >
            {t("home.hero.titleLine1")}
            <br />
            {t("home.hero.titleLine2")}
          </h1>

          {/* SWITCH EN/FR */}
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white shadow-sm text-xs sm:text-sm overflow-hidden">
            <button
              type="button"
              onClick={() => changeLang("en")}
              className={
                "px-3 py-1 sm:px-4 sm:py-1.5 transition " +
                (language === "en"
                  ? "bg-emerald-500 text-white font-semibold"
                  : "text-gray-700 hover:bg-gray-50")
              }
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => changeLang("fr")}
              className={
                "px-3 py-1 sm:px-4 sm:py-1.5 transition " +
                (language === "fr"
                  ? "bg-emerald-500 text-white font-semibold"
                  : "text-gray-700 hover:bg-gray-50")
              }
            >
              FR
            </button>
          </div>
        </header>

        <div className="mt-10 sm:mt-12" aria-hidden="true" />

        {/* ACCROCHE */}
        <section className="mb-8">
          <h3 className="text-xl sm:text-2xl font-semibold mb-4">
            {t("home.hero.subtitle")}
          </h3>
          <ul className="space-y-3 text-gray-900 text-lg sm:text-xl leading-relaxed pl-5 list-disc">
            <li>{t("home.hero.bullets.program")}</li>
            <li>{t("home.hero.bullets.timerMusic")}</li>
            <li>{t("home.hero.bullets.recipes")}</li>
          </ul>
        </section>

        {/* CTA */}
        <section className="w-full grid grid-rows-[1fr_auto]">
          <div
            aria-hidden="true"
            className="bg-white invisible h-[45vh] sm:h-[55vh]"
          />
          <div className="justify-self-center flex flex-col sm:flex-row items-center gap-3 mb-10">
            <button
              type="button"
              onClick={openLogin}
              aria-expanded={showLogin}
              aria-controls="login-panel"
              className={`${pillClass} transition hover:-translate-y-0.5 active:translate-y-0`}
              style={{
                ...pillStyle,
                background: "#16a34a",
                boxShadow: "0 10px 22px rgba(22,163,74,.35)",
                padding: "12px 22px",
              }}
            >
              {t("home.cta.login")}
            </button>

            <button
              type="button"
              onClick={openSignup}
              aria-expanded={showSignup}
              aria-controls="signup-panel"
              className={`${pillClass} transition hover:-translate-y-0.5 active:translate-y-0`}
              style={{
                ...pillStyle,
                background: "#16a34a",
                boxShadow: "0 10px 22px rgba(22,163,74,.35)",
                padding: "12px 22px",
              }}
            >
              {t("home.cta.signup")}
            </button>
          </div>
        </section>

        {/* ---- LOGIN ---- */}
        {showLogin && (
          <div id="login-panel" className="max-w-md mx-auto">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("home.login.emailLabel")}
                </label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={!inputsReady}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100"
                  placeholder={t("home.login.emailPlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("home.login.passwordLabel")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    disabled={!inputsReady}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 pr-12 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100"
                    placeholder={t("home.login.passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                    aria-label={
                      showPassword
                        ? t("common.password.hide")
                        : t("common.password.show")
                    }
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={pillClass + " w-full"}
                style={{ ...pillStyle, whiteSpace: "normal" }}
                disabled={loading || !inputsReady}
              >
                {loading
                  ? t("home.login.submitLoading")
                  : t("home.login.submitIdle")}
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="block w-full text-center text-sm text-gray-600 hover:underline"
                disabled={!inputsReady}
              >
                {t("home.login.forgotPassword")}
              </button>

              {message && (
                <p className="text-sm text-emerald-600 mt-2 text-center">
                  {message}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 mt-2 text-center">
                  {error}
                </p>
              )}
            </form>
          </div>
        )}

        {/* ---- SIGNUP ---- */}
        {showSignup && (
          <div id="signup-panel" className="max-w-md mx-auto">
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("home.signup.emailLabel")}
                </label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={!inputsReady}
                  value={emailSu}
                  onChange={(e) => setEmailSu(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100"
                  placeholder={t("home.signup.emailPlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("home.signup.passwordLabel")}
                </label>
                <div className="relative">
                  <input
                    type={showPasswordSignup ? "text" : "password"}
                    inputMode="text"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    disabled={!inputsReady}
                    value={passwordSu}
                    onChange={(e) => setPasswordSu(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 pr-12 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100"
                    placeholder={t("home.signup.passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswordSignup(!showPasswordSignup)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                    aria-label={
                      showPasswordSignup
                        ? t("common.password.hide")
                        : t("common.password.show")
                    }
                  >
                    {showPasswordSignup ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={pillClass + " w-full"}
                style={{ ...pillStyle, whiteSpace: "normal" }}
                disabled={loading || !inputsReady}
              >
                {loading
                  ? t("home.signup.submitLoading")
                  : t("home.signup.submitIdle")}
              </button>

              {message && (
                <p className="text-sm text-emerald-600 mt-2 text-center">
                  {message}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 mt-2 text-center">
                  {error}
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

