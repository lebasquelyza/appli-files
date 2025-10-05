"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";

export default function SigninPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputsReady, setInputsReady] = useState(false);

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
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMessage("Connexion réussie ✅");
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Impossible de se connecter");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Entrez votre e-mail pour réinitialiser votre mot de passe.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
    <main className="pt-14 py-10 sm:py-12">
      <div className="container max-w-md mx-auto px-4">
        <header className="text-left mb-6">
          <h1
            className="font-bold leading-tight not-prose
                       [font-size:theme(fontSize.2xl)!important]
                       sm:[font-size:theme(fontSize.3xl)!important]"
          >
            Files Coaching — Coach Sportif IA
          </h1>
        </header>

        <section className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-3">
            Séances personnalisées, conseils et suivi
          </h3>
          <ul className="space-y-2 text-gray-800 text-base sm:text-lg leading-relaxed pl-5 list-disc">
            <li>✅ Programme personnalisé adapté à vos objectifs</li>
            <li>✅ Minuteur & Musique intégrés pour vos séances</li>
            <li>✅ Recettes healthy & conseils nutrition</li>
          </ul>
        </section>

        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-left">
          Se connecter
        </h2>

        <form onSubmit={handleLogin} className="space-y-4">
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

          <button type="submit" className="btn w-full" disabled={loading || !inputsReady}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <p className="text-center text-base text-gray-600 mt-3">
            Pas encore de compte ?{" "}
            <a href="/signup" className="text-base font-semibold text-emerald-600 hover:underline">
              Créer un compte
            </a>
          </p>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="block w-full text-center text-sm text-gray-600 hover:underline mt-2"
            disabled={!inputsReady}
          >
            Mot de passe oublié ?
          </button>

          {message && <p className="text-sm text-emerald-600 mt-2 text-center">{message}</p>}
          {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
        </form>
      </div>
    </main>
  );
}
