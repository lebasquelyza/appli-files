"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = {
  id: string;
  title: string;
  channel: string;
  thumb?: string;
  url: string;
  embed: string;
  publishedAt?: string;
};

export default function DemoBrowser({
  initialQuery,
  onClose,
}: {
  initialQuery: string;
  onClose: () => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string>("");
  const [active, setActive] = useState<Item | null>(null);
  const firstRun = useRef(true);

  async function runSearch(query: string) {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/exo-demo?q=${encodeURIComponent(query)}&max=5`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Recherche impossible");
      setItems(data.items || []);
      setActive((data.items || [])[0] || null);
    } catch (e: any) {
      setError(e.message || "Erreur de recherche");
      setItems([]);
      setActive(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // première recherche
    if (firstRun.current) {
      firstRun.current = false;
      runSearch(q);
    }
  }, []);

  const ready = !loading && items.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(17,24,39,.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-xl"
        style={{ overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="font-semibold">Démo d’exercice</div>
          <button onClick={onClose} className="rounded-md px-3 py-1 text-sm border border-gray-200 hover:bg-gray-50">Fermer</button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
            className="flex gap-2"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Rechercher un tutoriel (ex: Rowing unilatéral)"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-black text-white px-3 py-2 text-sm font-semibold"
            >
              {loading ? "Recherche..." : "Rechercher"}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-0">
          <div className="p-4">
            {active ? (
              <div className="aspect-video w-full rounded-lg overflow-hidden border border-gray-200">
                <iframe
                  key={active.id}
                  src={active.embed}
                  title={active.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div className="text-sm text-gray-500">Aucune vidéo sélectionnée.</div>
            )}
            {active && (
              <div className="mt-3">
                <div className="font-semibold leading-tight">{active.title}</div>
                <div className="text-xs text-gray-600 mt-1">{active.channel}</div>
              </div>
            )}
          </div>

          <div className="border-t md:border-t-0 md:border-l border-gray-200 max-h-[60vh] md:max-h-[70vh] overflow-auto p-3">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2 mb-2">
                {error}
              </div>
            )}

            {loading && <div className="text-sm text-gray-500">Chargement…</div>}

            {ready && items.map((it) => (
              <button
                key={it.id}
                onClick={() => setActive(it)}
                className="w-full flex items-center gap-3 rounded-lg border border-gray-200 hover:bg-gray-50 mb-2 p-2 text-left"
              >
                <img
                  src={it.thumb || ""}
                  alt=""
                  className="w-16 h-10 object-cover rounded"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{it.title}</div>
                  <div className="text-xs text-gray-600 truncate">{it.channel}</div>
                </div>
              </button>
            ))}

            {!loading && !error && items.length === 0 && (
              <div className="text-sm text-gray-500">Aucun résultat</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
