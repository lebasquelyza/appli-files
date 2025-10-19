// apps/web/app/reset-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getSupabase } from "../../lib/supabaseClient";

type Phase = "init" | "ready" | "saving" | "done" | "error";

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>("init");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Styles cohérents
  const inputClass =
    "w-full border rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-emerald-500 outline-none";
  const btnClass =
    "inline-flex items-center justify-center font-semibold shadow px-3 py-2 rounded-lg transition hover:-translate-y-0.5 active:translate-y-0 w-full";
  const btnStyle: React.CSSProperties = {
    background: "#16a34a",
    color: "#fff",
    boxShadow: "0 10px 22px rgba(22,163,74,.35)",
  };

  // 1) Consommer les tokens du hash pour établir la session "recovery"
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();

        // Déjà connecté ?
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          setPhase("ready");
          return;
        }

        // Sinon, consommer les tokens de l'URL (#access_token, #refresh_token)
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        const p = new URLSearchParams(hash);
        const type = p.get("type");
        const access_token = p.get("access_token");
        const refresh_token = p.get("refresh_token");

        if (type === "recovery" && access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;

          // Nettoyer le hash (ne pas laisser les tokens dans l'historique)
          window.history.replaceState({}, document.title, window.location.pathname);
          setPhase("ready");
        } else {
          setErr("Lien de réinitialisation invalide ou expiré. Redemande un nouvel e-mail.");
          setPhase("error");
        }
      } catch (e: any) {
        setErr(e?.message || "Impossible d'initialiser la session.");
        setPhase("error");
      }
    })();
  }, []);

  // 2) Soumission : mise à jour du mot de passe
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password.length < 8) {
      setErr("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setErr("Les mots de passe ne correspondent pas.");
      return;
    }

    setPhase("saving");
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPhase("done");
    } catch (e: any) {
      setErr(e?.message || "Impossible de mettre à jour le mot de passe.");
      setPhase("ready");
    }
  }

  return (
    <main className="hide-topbar-menu pt-14 py-16">
      <div className="container max-w-md mx-auto px-4">
        {/* Écran confirmation après succès */}
        {phase === "done" ? (
          <>
            <h1
              className="not-prose font-bold mb-2 text-center
                         [font-size:theme(fontSize.2xl)!important]
                         sm:[font-size:theme(fontSize.3xl)!important]"
            >
              Mot de passe mis à jour ✅
            </h1>
            <p className="text-center text-sm text-gray-600 mb-6">
              Tu es désormais connecté. Que veux-tu faire ?
            </p>

            <div className="space-y-3">
              <a href="/dashboard" className={btnClass} style={btnStyle}>
                Accéder au tableau de bord
              </a>
              <a
                href="/"
                className="w-full text-center font-semibold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Retour à la page d’accueil
              </a>
            </div>
          </>
        ) : (
          <>
            <h1
              className="not-prose font-bold mb-2 text-center
                         [font-size:theme(fontSize.2xl)!important]
                         sm:[font-size:theme(fontSize.3xl)!important]"
            >
              Définir un nouveau mot de passe
            </h1>
            <p className="text-center text-sm text-gray-600 mb-6">
              Après validation, tu seras connecté à l’application automatiquement.
            </p>

            {phase === "init" && !err && (
              <div className="text-center text-gray-700">Initialisation…</div>
            )}

            {err && (
              <div className="max-w-md mx-auto mb-4 text-sm text-red-600 text-center">
                {err}{" "}
                <a href="/" className="underline">
                  Retour à la connexion
                </a>
              </div>
            )}

            {phase !== "init" && !err && (
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Nouveau mot de passe */}
                <div>
                  <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className={inputClass}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                      aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Confirmation */}
                <div>
                  <label className="block text-sm font-medium mb-1">Confirmer le mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPwd2 ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={8}
                      className={inputClass}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd2((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                      aria-label={showPwd2 ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPwd2 ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  // ✅ correctif TS: plus de test "|| phase === 'init'" dans ce bloc
                  disabled={phase === "saving"}
                  className={btnClass}
                  style={btnStyle}
                >
                  {phase === "saving" ? "Mise à jour…" : "Valider et me connecter"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
