"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // prêt à soumettre une fois la session établie

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();

        // 1) Si déjà connecté (onglet existant), ok
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          setReady(true);
          return;
        }

        // 2) Sinon, récupère les tokens du hash fourni par le lien de l'e-mail
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        const params = new URLSearchParams(hash);
        const type = params.get("type"); // "recovery" attendu
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (type === "recovery" && access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          // Nettoie le hash pour ne pas garder les tokens dans l'historique
          window.history.replaceState({}, document.title, window.location.pathname);
          setReady(true);
        } else {
          setErr(
            "Lien de réinitialisation invalide ou expiré. Redemande un nouvel e-mail."
          );
        }
      } catch (e: any) {
        setErr(e?.message || "Impossible d'initialiser la session.");
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      if (password.length < 8) {
        throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
      }
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg("Mot de passe mis à jour ✅ Redirection…");
      // L'utilisateur est déjà authentifié (session recovery) → on peut l'envoyer dans l'app
      setTimeout(() => (window.location.href = "/dashboard"), 900);
    } catch (e: any) {
      setErr(e?.message || "Impossible de mettre à jour le mot de passe.");
      console.error("[ResetPassword]", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Définir un nouveau mot de passe</h1>

      {!ready && !err && <p>Initialisation…</p>}

      {err && (
        <div className="mb-4 text-sm text-red-600">
          {err}{" "}
          <a href="/" className="underline">
            Retour à la connexion
          </a>
        </div>
      )}

      {ready && (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            required
            minLength={8}
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
            {busy ? "Mise à jour…" : "Valider et me connecter"}
          </button>
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        </form>
      )}
    </main>
  );
}
