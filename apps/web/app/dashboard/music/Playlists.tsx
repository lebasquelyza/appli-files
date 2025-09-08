"use client";
import { useEffect, useState } from "react";

export default function Playlists() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/spotify/playlists", { cache: "no-store" });
        const j = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            j?.error?.message || j?.error_description || j?.message || `HTTP ${res.status}`;
          if (res.status === 401) setNeedLogin(true);
          throw new Error(msg);
        }

        setData(j);
      } catch (e: any) {
        setErr(e?.message || "Erreur inconnue");
      }
    })();
  }, []);

  if (needLogin) {
    return (
      <div>
        <p>Session expirée ou non autorisée.</p>
        <a href="/api/auth/signin/spotify?callbackUrl=%2Fdashboard%2Fmusic">
          Se reconnecter à Spotify
        </a>
      </div>
    );
  }

  if (err) return <p style={{ color: "crimson" }}>Erreur: {err}</p>;
  if (!data) return <p>Chargement des playlists…</p>;

  const items = data.items ?? [];
  if (!items.length) return <p>Aucune playlist trouvée.</p>;

  return (
    <ul style={{ marginTop: 12, lineHeight: 1.8 }}>
      {items.map((p: any) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
