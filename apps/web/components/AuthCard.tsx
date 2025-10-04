// apps/web/components/AuthCard.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "signin" | "signup";

export default function AuthCard() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg("Connexion réussie. Redirection vers le dashboard…");
        // Redirige après un petit délai
        setTimeout(() => (window.location.href = "/dashboard"), 500);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/reset-password`,
          },
        });
        if (error) throw error;
        setMsg("Compte créé ! Vérifie tes e-mails pour confirmer l’adresse.");
      }
    } catch (e: any) {
      setErr(e?.message || "Une erreur est survenue.");
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
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMsg("E-mail de réinitialisation envoyé. Vérifie ta boîte mail.");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’envoyer l’e-mail.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto border rounded-2xl p-6 shadow-sm">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border ${mode==="signin" ? "bg-gray-900 text-white" : "hover:bg-gray-50"}`}
          aria-pressed={mode==="signin"}
        >
          Connexion
        </button>
        <button
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border ${mode==="signup" ? "bg-gray-900 text-white" : "hover:bg-gray-50"}`}
          aria-pressed={mode==="signup"}
        >
          Créer un compte
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Adresse e-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={e=>setEmail(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600/30"
            placeholder="vous@exemple.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={e=>setPassword(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600/30"
            placeholder="••••••••"
            autoComplete={mode==="signin" ? "current-password" : "new-password"}
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? "Veuillez patienter…" : (mode==="signin" ? "Se connecter" : "Créer le compte")}
        </button>

        <button
          type="button"
          onClick={onForgot}
          className="block w-full text-center text-sm text-gray-600 hover:underline"
          disabled={busy}
        >
          Mot de passe oublié ?
        </button>

        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </div>
  );
}
