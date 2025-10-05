"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabaseClient";
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
    // ⬇️ ajout du pt-14 pour descendre sous la topbar
    <main className="pt-14 py-16">
      <div className="container max-w-md mx-auto px-4">
        {/* ✅ Titre intégré dans la page, même taille que les autres */}
        <h1 className="not-prose text-2xl sm:text-3xl font-bold mb-8 text-center">
          Se connecter
        </h1>

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
                className="w-full border rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100"
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

          <p className="text-center text-sm text-gray-600 mt-3">
            Pas encore de compte ?{" "}
            <a href="/signup" className="text-emerald-600 hover:underline">
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

