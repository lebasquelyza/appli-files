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
  MessageCircle,
  ClipboardList,
  Music2,
  Settings,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type NavKey =
  | "home"
  | "profile"
  | "progress"
  | "corrector"
  | "recipes"
  | "calories"
  | "connect"
  | "bmi"
  | "motivation"
  | "music"
  | "avis"
  | "settings";

type NavItem = {
  href: string;
  key: NavKey;
  icon?: React.ComponentType<{ size?: number }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "home", icon: Home },
  { href: "/dashboard/profile", key: "profile", icon: User2 },
  { href: "/dashboard/progress", key: "progress", icon: LineChart },
  { href: "/dashboard/corrector", key: "corrector", icon: Wand2 },
  { href: "/dashboard/recipes", key: "recipes", icon: BookOpen },
  { href: "/dashboard/calories", key: "calories", icon: Flame },
  { href: "/dashboard/connect", key: "connect", icon: Plug2 },
  { href: "/dashboard/bmi", key: "bmi", icon: ClipboardList },
  { href: "/dashboard/motivation", key: "motivation", icon: MessageCircle },
  { href: "/dashboard/music", key: "music", icon: Music2 },
  { href: "/dashboard/avis", key: "avis", icon: MessageCircle },
  { href: "/dashboard/settings", key: "settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // fermé par défaut
  const { lang } = useLanguage();

  // Filet de sécurité : replier à chaque changement de route
  useEffect(() => setOpen(false), [pathname]);

  // Fermer APRÈS que le clic ait été géré par <Link> (fiable iOS)
  const closeAfterClick = () => {
    requestAnimationFrame(() => setOpen(false));
  };

  // 🔤 change la langue via cookie + reload
  const changeLang = (newLang: "fr" | "en") => {
    try {
      document.cookie = [
        `fc-lang=${newLang}`,
        "Path=/",
        "SameSite=Lax",
        "Max-Age=31536000`, // 1 an
      ].join("; ");
      window.location.reload();
    } catch {
      // on ignore si ça plante
    }
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
        {/* Ligne : Files-Menu + FR/EN */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="sidebar-links"
            style={{
              flex: 1,
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

          {/* 🔤 Switch langue juste à côté de Files-Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              onClick={() => changeLang("fr")}
              style={{
                padding: "3px 8px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                fontSize: 11,
                background: lang === "fr" ? "#16a34a" : "#fff",
                color: lang === "fr" ? "#fff" : "#374151",
                cursor: "pointer",
              }}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => changeLang("en")}
              style={{
                padding: "3px 8px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                fontSize: 11,
                background: lang === "en" ? "#16a34a" : "#fff",
                color: lang === "en" ? "#fff" : "#374151",
                cursor: "pointer",
              }}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* ===== Liste des onglets — masquée par défaut ===== */}
      <ul
        id="sidebar-links"
        style={{
          display: open ? "block" : "none",
          listStyle: "none",
          padding: 0,
          margin: 0,
          maxHeight: "calc(100dvh - 80px)",
          overflowY: "auto",
        }}
      >
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");

          return (
            <li key={href}>
              <Link
                href={href}
                className="block no-underline"
                onClick={closeAfterClick}
              >
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
                    border: active
                      ? "1px solid rgba(22,163,74,.25)"
                      : "1px solid transparent",
                    boxShadow: active ? "0 10px 20px rgba(0,0,0,.08)" : "none",
                    color: active ? "#fff" : "var(--text, #111)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {Icon ? <Icon size={18} /> : null}
                  {/* texte du menu = traduction nav.X */}
                  <span>{/* on ne peut pas utiliser useLanguage ici directement */}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
