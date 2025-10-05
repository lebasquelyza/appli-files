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
    <main className="py-16">
      <div className="container max-w-md mx-auto">
        {/* ✅ 1. Titre et sous-titre */}
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Files Coaching — Coach Sportif IA</h1>
          <p className="text-lg text-gray-700">
            L'assistant intelligent qui optimise votre performance.
          </p>
        </header>

        {/* ✅ 2. Points forts */}
        <section className="mb-12 text-center">
          <h3 className="text-2xl font-semibold mb-4">
            Séances personnalisées, conseils et suivi
          </h3>
          <ul className="space-y-2 text-gray-700 text-lg">
            <li>✅ Programme personnalisé adapté à vos objectifs</li>
            <li>✅ Minuteur & Musique intégrés pour vos séances</li>
            <li>✅ Recettes healthy & conseils nutrition</li>
          </ul>
        </section>

        {/* ✅ 3. Formulaire de connexion */}
        <h2 className="text-3xl font-bold mb-6 text-center">Se connecter</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Champ e-mail */}
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

          {/* Champ mot de passe */}
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
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                tabIndex={-1}
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
            <a
              href="/signup"
              className="text-base font-semibold text-emerald-600 hover:underline"
            >
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

