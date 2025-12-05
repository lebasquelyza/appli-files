// apps/web/components/AuthCard.tsx
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabaseClient";

type Mode = "signin" | "signup";

export default function AuthCard() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // (optionnel) petits logs pour vérifier l'injection des env; retire-les après.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL, (window as any)?.__env?.NEXT_PUBLIC_SUPABASE_URL);
    // eslint-disable-next-line no-console
    console.log(
      "SUPABASE_ANON:",
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0, 6) + "…",
      ((window as any)?.__env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0, 6) + "…"
    );
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const supabase = getSupabase();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg("Connexion réussie. Redirection vers le dashboard…");
        setTimeout(() => (window.location.href = "/dashboard"), 500);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/reset-password` },
        });
        if (error) throw error;
        setMsg("Compte créé ! Vérifie tes e-mails pour confirmer l’adresse.");
      }
    } catch (e: any) {
      setErr(e?.message || "Une erreur est survenue.");
      // eslint-disable-next-line no-console
      console.error("[AuthCard submit]", e);
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      if (!email) {
        setErr("Entre d’abord ton e-mail puis clique sur « Mot de passe oublié ? »");
        return;
      }
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMsg("E-mail de réinitialisation envoyé. Vérifie ta boîte mail.");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’envoyer l’e-mail.");
      // eslint-disable-next-line no-console
      console.error("[AuthCard forgot]", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 max-w-md w-full mx-auto">
      {/* Segmented control */}
      <div className="inline-flex bg-gray-100 rounded-full p-1 mb-5">
        <button
          onClick={() => setMode("signin")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
            mode === "signin" ? "bg-gray-900 text-white shadow" : "text-gray-700 hover:bg-white"
          }`}
          aria-pressed={mode === "signin"}
        >
          Connexion
        </button>
        <button
          onClick={() => setMode("signup")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
            mode === "signup" ? "bg-gray-900 text-white shadow" : "text-gray-700 hover:bg-white"
          }`}
          aria-pressed={mode === "signup"}
        >
          Créer un compte
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Adresse e-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600/30"
            placeholder="vous@exemple.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600/30"
            placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>

        {/* Bouton principal → ta classe `btn` (vert) */}
        <button type="submit" disabled={busy} className="btn w-full disabled:opacity-60">
          {busy ? "Veuillez patienter…" : mode === "signin" ? "Se connecter" : "Créer le compte"}
        </button>

        <button
          type="button"
          onClick={onForgot}
          disabled={busy}
          className="block w-full text-center text-sm text-gray-600 hover:underline"
        >
          Mot de passe oublié ?
        </button>

        {/* Messages */}
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </div>
  );
}
