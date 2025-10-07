"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getSupabase } from "../lib/supabaseClient";

export default function HomePage() {
  // UI state
  const [showLogin, setShowLogin] = useState(false);
  const [inputsReady, setInputsReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auth state
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      // import dynamique pour éviter les soucis de résolution pendant le build
      const { getSupabase } = await import("../lib/supabaseClient");
      const supabase = getSupabase();

      const emailTrim = email.trim().toLowerCase();
      const passTrim = password.trim();

      const { error } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: passTrim,
      });
      if (error) throw error;

      setMessage("Connexion réussie ✅");
      window.location.href = "/dashboard";
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("invalid login credentials")) {
        setError("Identifiants invalides. Vérifie l’e-mail/mot de passe, ou confirme ton e-mail.");
      } else {
        setError(msg || "Impossible de se connecter");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setError("Entrez votre e-mail pour réinitialiser votre mot de passe.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const { getSupabase } = await import("./lib/supabaseClient");
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
  };

  // style commun bouton vert (rectangle arrondi, texte blanc)
  const btnGreen =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-base font-semibold shadow " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 " +
    "active:translate-y-px transition";

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

        {/* Espace sous le titre */}
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

        {/* CTA : Connecte-toi | ou | Créer un compte */}
        <div className="mt-2 mb-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLogin((v) => !v)}
            aria-expanded={showLogin}
            aria-controls="login-panel"
            className={btnGreen}
            style={{ backgroundColor: "#059669", color: "#fff" }}
          >
            Connecte-toi
          </button>

          {/* pastille “ou” verte */}
          <span
            className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold select-none shadow"
            style={{ backgroundColor: "#059669", color: "#fff" }}
          >
            ou
          </span>

          <a
            href="/signup"
            role="button"
            className={btnGreen}
            style={{ backgroundColor: "#059669", color: "#fff" }}
          >
            Créer un compte
          </a>
        </div>

        {/* Panneau de connexion inline */}
        {showLogin && (
          <div id="login-panel" className="max-w-md">
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1">Adresse e-mail</label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  required
                  disabled={!inputsReady}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100"
                  placeholder="vous@exemple.com"
                />
              </div>

              {/* Mot de passe */}
              <div>
                <label className="block text-sm font-medium mb-1">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="off"
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

              <button type="submit" className={btnGreen + " w-full"} style={{ backgroundColor: "#059669", color: "#fff" }} disabled={loading || !inputsReady}>
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
