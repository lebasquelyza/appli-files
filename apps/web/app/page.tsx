// apps/web/app/page.tsx  (ou apps/web/app/signin/page.tsx si ta route de login est /signin)
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getSupabase } from "../lib/supabaseClient";

// --- helper cookie (lisible serveur + client) ---
function setAppEmailCookie(val: string) {
  try {
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = [
      `app_email=${encodeURIComponent(val)}`,
      "Path=/",
      "SameSite=Lax",
      isHttps ? "Secure" : "",
      "Max-Age=31536000" // 365 jours
    ].filter(Boolean).join("; ");
  } catch {}
}

export default function HomePage() {
  // UI
  const [showLogin, setShowLogin] = useState(false);
  const [inputsReady, setInputsReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setInputsReady(true);
      if (typeof document !== "undefined") {
        document.activeElement instanceof HTMLElement && document.activeElement.blur();
      }
    }, 300);
    return () => clearTimeout(t);
  }, []);

  // (facultatif) si déjà connecté, synchronise le cookie au mount
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        const currentEmail = user?.email?.trim().toLowerCase();
        if (currentEmail) setAppEmailCookie(currentEmail);
      } catch {}
    })();
  }, []);

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

      // récupère l’email canonique et pose le cookie
      const { data: { user } } = await supabase.auth.getUser();
      const sessionEmail = (user?.email || emailTrim).trim().toLowerCase();
      if (sessionEmail) setAppEmailCookie(sessionEmail);

      setMessage("Connexion réussie ✅");
      // ✅ on garde ton flux: retour sur /dashboard
      window.location.href = "/dashboard";
    } catch (err: any) {
      const msg = String(err?.message || "");
      setError(
        msg.toLowerCase().includes("invalid login credentials")
          ? "Identifiants invalides. Vérifie l’e-mail/mot de passe, ou confirme ton e-mail."
          : msg || "Impossible de se connecter"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setError("Entrez votre e-mail pour réinitialiser votre mot de passe.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(emailTrim, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMessage("E-mail de réinitialisation envoyé 📩");
    } catch (err: any) {
      setError(err.message || "Erreur lors de la réinitialisation");
    } finally {
      setLoading(false);
    }
  }

  /** Style "pill" compact et cohérent */
  const pillClass =
    "inline-flex items-center justify-center font-semibold shadow " +
    "px-3 py-1.5 select-none active:translate-y-px focus:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-emerald-500/30 leading-none";
  const pillStyle: React.CSSProperties = {
    background: "linear-gradient(90deg,#22c55e,#16a34a)",
    color: "#fff",
    textDecoration: "none",
    borderRadius: 9999,
    WebkitTapHighlightColor: "transparent",
    whiteSpace: "nowrap",
  };

  return (
    <main className="hide-topbar-menu pt-10 sm:pt-12 pb-12">
      <div className="container max-w-screen-lg mx-auto px-4">
        {/* Titre */}
        <header className="mb-0">
          <h1
            className="font-bold leading-tight not-prose
                       [font-size:theme(fontSize.3xl)!important]
                       sm:[font-size:theme(fontSize.5xl)!important]"
          >
            Files Coaching —<br /> Coach Sportif IA
          </h1>
        </header>

        <div className="mt-10 sm:mt-12" aria-hidden="true" />

        {/* Accroche */}
        <section className="mb-8">
          <h3 className="text-xl sm:text-2xl font-semibold mb-4">
            Séances personnalisées, conseils et suivi
          </h3>
          <ul className="space-y-3 text-gray-900 text-lg sm:text-xl leading-relaxed pl-5 list-disc">
            <li>✅ Programme personnalisé adapté à vos objectifs</li>
            <li>✅ Minuteur &amp; Musique intégrés pour vos séances</li>
            <li>✅ Recettes healthy &amp; conseils nutrition</li>
          </ul>
        </section>

        {/* CTA */}
        <section className="w-full grid grid-rows-[1fr_auto]">
          <div aria-hidden="true" className="bg-white invisible h-[45vh] sm:h-[55vh]" />
          <div className="justify-self-center flex flex-col sm:flex-row items-center gap-3 mb-10">
            <button
              type="button"
              onClick={() => setShowLogin((v) => !v)}
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
              Connecte-toi
            </button>

            <button
              type="button"
              onClick={() => (window.location.href = "/signup")}
              className={`${pillClass} transition hover:-translate-y-0.5 active:translate-y-0`}
              style={{
                ...pillStyle,
                background: "#16a34a",
                boxShadow: "0 10px 22px rgba(22,163,74,.35)",
                padding: "12px 22px",
              }}
              aria-label="Créer un compte"
            >
              Créer un compte
            </button>
          </div>
        </section>

        {/* Login inline */}
        {showLogin && (
          <div id="login-panel" className="max-w-md mx-auto">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Adresse e-mail</label>
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
                  placeholder="vous@exemple.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mot de passe</label>
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
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
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
                {loading ? "Connexion..." : "Se connecter"}
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="block w-full text-center text-sm text-gray-600 hover:underline"
                disabled={!inputsReady}
              >
                Mot de passe oublié ?
              </button>

              {message && <p className="text-sm text-emerald-600 mt-2 text-center">{message}</p>}
              {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

