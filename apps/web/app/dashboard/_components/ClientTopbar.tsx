"use client";

import { useEffect, useState } from "react";
// ajuste l'import selon ton chemin/alias :
import Sidebar from "@/components/Sidebar"; // ou: ../../components/Sidebar

export default function ClientTopbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        className="fixed inset-x-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 h-10 flex items-center justify-between">
          {/* 👉 'Files - Menu' ouvre le drawer (mobile). Sur desktop, pas d’action. */}
          <button
            className="font-bold text-lg leading-none select-none md:pointer-events-none md:cursor-default"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            style={{ cursor: "pointer" }}
          >
            Files - Menu
          </button>

          <div className="flex items-center gap-2">{/* actions à droite si besoin */}</div>
        </div>
      </header>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed left-0 top-0 z-[60] h-dvh w-[84%] max-w-[320px] bg-white shadow-xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
          >
            <div className="flex items-center justify-between px-3 pb-2">
              <b>Menu</b>
              <button
                className="rounded-md border px-2 py-1 text-sm"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
              >
                ✕
              </button>
            </div>
            {/* Clique sur un lien => ferme le panneau */}
            <div onClick={() => setOpen(false)}>
              <Sidebar />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
