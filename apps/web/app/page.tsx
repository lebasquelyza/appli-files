"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";

export default function HomePage() {
  // état CTA + formulaire inline
  const [showLogin, setShowLogin] = useState(false);

  // champs & UI
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inputsReady, setInputsReady] = useState(false);
  const [loading, setLoading] = useState(false);

  // messages
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setInputsReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });
      if (error) throw error;
      setMessage("Connexion réussie ✅");
      window.location.href = "/dashboard";
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("invalid login credentials")) {
        setError("Identifiants invalides. Vérifie l’e-mail/mot de passe ou confirme ton e-mail.");
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
      setError("Entre ton e-mail pour réinitialiser ton mot de passe.");
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
  };

  return (
    <main className="hide-topbar-menu pt-14 py-10 sm:py-12">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Titre */}
        <header className="text-left mb-0">
          <h1
            className="font-bold leading-tight not-prose
                       [font-size:theme(fontSize.3xl)!important]
                       sm:[font-size:theme(fontSize.5xl)!important]"
          >
            Files Coaching —<br />
            Coach Sportif IA
          </h1>
        </header>

        {/* Espace sous le titre */}
        <div className="mt-10 sm:mt-12" aria-hidden="true" />

        {/* Points forts */}
        <section className="mt-6 sm:mt-8 mb-10">
          <h3 className="text-xl sm:text-2xl font-semibold mb-4">
            Séances personnalisées, conseils et suivi
          </h3>
          <ul className="space-y-3 text-gray-800 text-lg leading-relaxed pl-6 list-disc">
            <li>✅ Programme personnalisé adapté à vos objectifs</li>
            <li>✅ Minuteur & Musique intégrés pour vos séances</li>
            <li>✅ Recettes healthy & conseils nutrition</li>
          </ul>
        </section>

        {/* Ligne d’action : Connecte-toi (ouvre le formulaire) | Créer un compte */}
        <div className="mt-6 mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowLogin((v) => !v)}
            aria-expanded={showLogin}
            aria-controls="login-panel"
            className="inline-flex items-baseline gap-1
                       text-lg font-semibold
                       text-blue-600 hover:underline
                       bg-transparent appearance-none border-0 p-0 m-0
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                       [-webkit-tap-highlight-color:transparent]"
          >
            Connecte-toi
          </button>

          <a
            href="/signup"
            className="text-lg text-emerald-600 font-semibold hover:underline"
          >
            Créer un compte
          </a>
        </div>

        {/* Formulaire de connexion inline */}
        {showLogin && (
          <div id="login-panel" className="mt-2 max-w-md">
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
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

              {/* Mot de passe + œil */}
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

              <button type="submit" className="btn w-full" disabled={loading || !inputsReady}>
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

              {message && <p className="text-sm text-emerald-600 mt-2">{message}</p>}
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
