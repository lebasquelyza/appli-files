"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputsReady, setInputsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setInputsReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = getSupabase();
      const emailTrim = email.trim().toLowerCase();
      const passTrim = password.trim();

      const { data, error } = await supabase.auth.signUp({
        email: emailTrim,
        password: passTrim,
        options: { emailRedirectTo: `${window.location.origin}/reset-password` },
      });

      if (error) throw error;

      if (data?.user && !data.user.email_confirmed_at) {
        setMessage(
          "Compte créé ✅. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter."
        );
      } else {
        setMessage("Compte créé ✅");
      }
    } catch (err: any) {
      const raw = String(err?.message || "");
      let friendly = raw;

      if (/user.*registered/i.test(raw)) {
        friendly =
          "Cet e-mail a déjà un compte. Essaie ‘Mot de passe oublié ?’ pour réinitialiser.";
      } else if (/password/i.test(raw) && /length|weak|least/i.test(raw)) {
        friendly = "Mot de passe trop faible (vérifie la longueur minimale définie).";
      } else if (/redirect/i.test(raw) && /url/i.test(raw)) {
        friendly =
          "URL de redirection non autorisée. Ajoute ton domaine de prod dans Supabase > Auth > URL Configuration.";
      }

      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setError("Entre ton e-mail pour renvoyer la confirmation.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailTrim,
        options: { emailRedirectTo: `${window.location.origin}/reset-password` },
      });
      if (error) throw error;
      setMessage("E-mail de confirmation renvoyé 📩");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l’envoi de la confirmation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="hide-topbar-menu pt-14 py-16">
      <div className="container max-w-md mx-auto">
        <h1
          className="not-prose font-bold mb-2 text-center
                     [font-size:theme(fontSize.2xl)!important]
                     sm:[font-size:theme(fontSize.3xl)!important]"
        >
          Créer un compte
        </h1>

        {/* Petit message de bienvenue */}
        <p className="text-center text-sm text-gray-600 mb-6">
          Bienvenue 👋
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
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
                autoComplete="new-password"
                autoCapitalize="none"
                spellCheck={false}
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
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn w-full" disabled={loading || !inputsReady}>
            {loading ? "Création..." : "Créer mon compte"}
          </button>

          {/* Bloc “Déjà un compte ? Se connecter” supprimé */}

          <button
            type="button"
            onClick={handleResendConfirmation}
            className="block w-full text-center text-sm text-gray-600 hover:underline mt-2"
            disabled={!inputsReady}
          >
            Renvoyer l’e-mail de confirmation
          </button>

          {message && <p className="text-sm text-emerald-600 mt-2 text-center">{message}</p>}
          {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
        </form>
      </div>
    </main>
  );
}

