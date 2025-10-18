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

      // ➜ plus de emailRedirectTo : on n’envoie pas d’email de confirmation
      const { data, error } = await supabase.auth.signUp({
        email: emailTrim,
        password: passTrim,
      });
      if (error) throw error;

      // En mode "auto-confirm", l’utilisateur est connecté immédiatement.
      // Si tu veux qu’il doive se reconnecter : force un signOut.
      await supabase.auth.signOut();

      setMessage("Inscription réussie ✅ Tu peux maintenant te connecter.");
      // Option : rediriger après 1–2 s
      // setTimeout(() => (window.location.href = "/"), 1500);
    } catch (err: any) {
      const raw = String(err?.message || "");
      let friendly = raw;

      if (/user.*registered/i.test(raw)) {
        friendly = "Cet e-mail a déjà un compte. Utilise “Mot de passe oublié ?”.";
      } else if (/password/i.test(raw) && /(length|weak|least|min)/i.test(raw)) {
        friendly = "Mot de passe trop faible (allonge-le et ajoute variété).";
      }
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="hide-topbar-menu pt-14 py-16">
      <div className="container max-w-md mx-auto">
        <h1 className="not-prose font-bold mb-2 text-center
                       [font-size:theme(fontSize.2xl)!important]
                       sm:[font-size:theme(fontSize.3xl)!important]">
          Créer un compte
        </h1>

        <p className="text-center text-sm text-gray-600 mb-6">Bienvenue 👋</p>

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

          {/* ➜ Bouton “Renvoyer l’e-mail de confirmation” retiré */}
          {message && <p className="text-sm text-emerald-600 mt-2 text-center">{message}</p>}
          {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}

          <p className="text-center text-sm mt-2">
            <a href="/" className="underline">Se connecter</a>
          </p>
        </form>
      </div>
    </main>
  );
}
