// apps/web/app/reset-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
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
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg("Mot de passe mis à jour. Vous pouvez vous connecter.");
      setTimeout(() => (window.location.href = "/dashboard"), 800);
    } catch (e: any) {
      setErr(e?.message || "Impossible de mettre à jour le mot de passe.");
      // eslint-disable-next-line no-console
      console.error("[ResetPassword]", e);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    try {
      const supabase = getSupabase();
      supabase.auth.getSession().then(() => {});
    } catch (e) {
      // Pas bloquant, affichage déjà géré par onSubmit si besoin
      // eslint-disable-next-line no-console
      console.warn("[ResetPassword init]", e);
    }
  }, []);

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Définir un nouveau mot de passe</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nouveau mot de passe"
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600/30"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? "Mise à jour…" : "Valider"}
        </button>
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </main>
  );
}

