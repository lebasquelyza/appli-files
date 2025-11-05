// apps/web/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  Home,
  User2,
  LineChart,
  Wand2,
  BookOpen,
  Flame,
  Plug2,
  CreditCard,
  ClipboardList,
  Music2,
  Settings,
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
  { href: "/dashboard/bmi", label: "IMC", icon: ClipboardList },
  { href: "/dashboard/music", label: "Musique", icon: Music2 },
  { href: "/dashboard/settings", label: "Réglages", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // fermé par défaut

  // Filet de sécurité : replier à chaque changement de route
  useEffect(() => setOpen(false), [pathname]);

  // Fermer APRÈS que le clic ait été géré par <Link> (fiable iOS)
  const closeAfterClick = () => {
    // laisse passer le click, puis ferme dès la prochaine frame
    requestAnimationFrame(() => setOpen(false));
  };

  return (
    <nav aria-label="Dashboard" style={{ paddingLeft: 10, paddingRight: 10 }}>
      {/* ===== Entête sticky collée en haut avec safe-area ===== */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: 6,
          background: "linear-gradient(180deg,#fff 75%,rgba(255,255,255,0) 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="sidebar-links"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 8px 4px 8px",
            borderRadius: 8,
            textAlign: "left",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {/* Pastille verte (non interactive) */}
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
          {/* Bouton d’ouverture */}
          <b style={{ fontSize: 18, lineHeight: 1, color: "var(--text, #111)" }}>
            Files-Menu
          </b>
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

      {/* ===== Liste des onglets — masquée par défaut ===== */}
      <ul
        id="sidebar-links"
        // Force le display via style (pas de conflit avec Tailwind)
        style={{
          display: open ? "block" : "none",
          listStyle: "none",
          padding: 0,
          margin: 0,
          maxHeight: "calc(100dvh - 80px)",
          overflowY: "auto",
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              {/* onClick -> ferme APRÈS le click pour ne pas casser la nav */}
              <Link href={href} className="block no-underline" onClick={closeAfterClick}>
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
                    boxShadow: active ? "0 10px 20px rgba(0,0,0,.08)" : "none",
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

