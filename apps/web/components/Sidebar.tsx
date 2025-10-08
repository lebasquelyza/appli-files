"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown, Home, User2, LineChart, Wand2, BookOpen,
  Flame, Plug2, CreditCard, ClipboardList, Music2, Settings,
} from "lucide-react";

type NavItem = { href: string; label: string; icon?: React.ComponentType<{ size?: number }> };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/dashboard/profile", label: "Mon profil", icon: User2 },
  { href: "/dashboard/progress", label: "Mes progrès", icon: LineChart },
  { href: "/dashboard/corrector", label: "Files te corrige", icon: Wand2 },
  { href: "/dashboard/recipes", label: "Recettes", icon: BookOpen },
  { href: "/dashboard/calories", label: "Calories", icon: Flame },
  { href: "/dashboard/connect", label: "Connecte tes données", icon: Plug2 },
  { href: "/dashboard/pricing", label: "Abonnement", icon: CreditCard },
  { href: "/dashboard/bmi", label: "IMC", icon: ClipboardList },
  { href: "/dashboard/music", label: "Musique", icon: Music2 },
  { href: "/dashboard/settings", label: "Réglages", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // fermé par défaut

  // filet de sécu : replier à chaque changement de route
  useEffect(() => setOpen(false), [pathname]);

  return (
    <nav aria-label="Dashboard" style={{ paddingLeft: 10, paddingRight: 10 }}>
      {/* En-tête sticky tout en haut à gauche */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          paddingBottom: 8,
          background: "linear-gradient(180deg,#fff 70%,rgba(255,255,255,0) 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="sidebar-links"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 8px 6px 8px",
            borderRadius: 8,
            textAlign: "left",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {/* Carré dégradé (non interactif) */}
          <span
            aria-hidden
            style={{
              display: "inline-block",
              height: 32,
              width: 32,
              borderRadius: 12,
              boxShadow: "0 6px 16px rgba(0,0,0,.08)",
              background:
                "linear-gradient(135deg,var(--brand,#22c55e),var(--brand2,#15803d))",
            }}
          />
          {/* 👉 “Files” = bouton d’ouverture */}
          <b style={{ fontSize: 18, lineHeight: 1 }}>Files</b>
          <ChevronDown
            size={16}
            style={{
              marginLeft: "auto",
              transition: "transform .2s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
      </div>

      {/* Liste des onglets — MASQUÉE par défaut (display inline) */}
      <ul
        id="sidebar-links"
        // ✅ pas de classes tailwind; on force le display ici
        style={{
          display: open ? "block" : "none",
          listStyle: "none",
          padding: 0,
          margin: 0,
          maxHeight: "calc(100dvh - 80px)",
          overflowY: "auto",
        }}
        // ferme AVANT la navigation (fiable iOS/Safari)
        onPointerDownCapture={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest("a[href]")) setOpen(false);
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link href={href} className="block no-underline">
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    margin: "4px 6px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: active
                      ? "linear-gradient(135deg,var(--brand,#22c55e),var(--brand2,#15803d))"
                      : "transparent",
                    border: active ? "1px solid rgba(22,163,74,.25)" : "1px solid transparent",
                    boxShadow: active
                      ? "0 10px 20px rgba(0,0,0,.08)"
                      : "none",
                    color: active ? "#fff" : "var(--text, #111)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {Icon ? <Icon size={18} /> : null}
                  <span>{label}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
