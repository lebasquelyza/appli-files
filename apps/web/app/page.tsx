"use client";

import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleSignup = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/reset-password` },
      });
      if (error) throw error;
      setMessage("Compte créé ✅ Vérifie ton e-mail pour confirmer ton compte.");
    } catch (err: any) {
      setError(err.message || "Impossible de créer un compte");
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
    <main>
      <section>
        <div className="container" style={{ maxWidth: 1100, marginInline: "auto", padding: "0 16px" }}>
          {/* Texte d'accueil conservé */}
          <div style={{ display: "grid", gap: 24, alignItems: "center", paddingTop: 16 }}>
            <div>
              <h1 className="h1">Files Le Coach — Coach Sportif IA</h1>
              <p className="lead">Séances personnalisées, conseils et suivi.</p>
              <div style={{ height: 16 }} />
              <ul className="space-y-4" style={{ margin: 0, paddingLeft: 18 }}>
                <li>Programme personnalisé</li>
                <li>Minuteur &amp; Musique</li>
                <li>Recettes healthy</li>
              </ul>
            </div>

            {/* Formulaire visible (adresse e-mail + mot de passe) */}
            <form onSubmit={handleLogin} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm font-medium mb-1">Adresse e-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="vous@exemple.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="••••••••"
                />
              </div>

              {/* Boutons au même design que ton ancien bouton (classe .btn) */}
              <button type="submit" className="btn w-full" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </button>

              <button
                type="button"
                onClick={handleSignup}
                className="btn w-full bg-gray-800 hover:bg-gray-900"
                disabled={loading}
              >
                Créer un compte
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="block w-full text-center text-sm text-gray-600 hover:underline mt-2"
              >
                Mot de passe oublié ?
              </button>

              {message && <p className="text-sm text-emerald-600 mt-2">{message}</p>}
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
