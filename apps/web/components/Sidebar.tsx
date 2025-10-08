"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/dashboard/profile", label: "Mon profil" },
  { href: "/dashboard/progress", label: "Mes progrès" },
  { href: "/dashboard/corrector", label: "Files te corrige" },
  { href: "/dashboard/recipes", label: "Recettes" },
  { href: "/dashboard/calories", label: "Calories" },
  { href: "/dashboard/connect", label: "Connecte tes données" },
  { href: "/dashboard/pricing", label: "Abonnement" },
  { href: "/dashboard/bmi", label: "IMC" },
  { href: "/dashboard/music", label: "Musique" },
  { href: "/dashboard/settings", label: "Réglages" },
];

export default function Sidebar() {
  const pathname = usePathname();

  // Ouvert par défaut en desktop, fermé en mobile
  const [open, setOpen] = useState(false);

  // media query util
  const mql = useMemo(() => (typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)") : null), []);

  // sync initiale + on resize
  useEffect(() => {
    if (!mql) return;
    const sync = () => setOpen(mql.matches);
    sync();
    mql.addEventListener?.("change", sync);
    return () => mql.removeEventListener?.("change", sync);
  }, [mql]);

  // referme sur changement de route (mobile)
  useEffect(() => {
    if (!mql || mql.matches) return; // desktop => ne rien faire
    setOpen(false);
  }, [pathname, mql]);

  // handler: clic sur un lien -> refermer en mobile
  const handleLinkClick = () => {
    if (!mql || mql.matches) return; // desktop = ne pas refermer
    setOpen(false);
  };

  return (
    <nav aria-label="Dashboard" style={{ padding: 10 }}>
      {/* Bouton sticky en haut du panneau */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,1) 70%, rgba(255,255,255,0) 100%)",
          // bordure basse légère pour mieux séparer quand on scrolle
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          paddingBottom: 6,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="sidebar-links"
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-50 md:hover:bg-transparent md:cursor-default md:pointer-events-none"
          style={{ textAlign: "left" }}
        >
          <span className="mark" />
          <b>Files - Menu</b>
          <ChevronDown
            size={16}
            className={`ml-auto transition-transform md:hidden ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Liste : ouverte en desktop, toggle en mobile */}
      <ul
        id="sidebar-links"
        className={`${open ? "block" : "hidden"} md:block`}
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          maxHeight: "calc(100dvh - 80px)",
          overflowY: "auto",
        }}
      >
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                onClick={handleLinkClick}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 10,
                  margin: "4px 6px",
                  fontWeight: 600,
                  textDecoration: "none",
                  background: active
                    ? "linear-gradient(135deg,var(--brand),var(--brand2))"
                    : "transparent",
                  border: active ? "1px solid rgba(22,163,74,.25)" : "1px solid transparent",
                  boxShadow: active ? "var(--shadow)" : "none",
                  color: active ? "#fff" : "var(--text, #111)",
                }}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}


