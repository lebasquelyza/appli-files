// components/Sidebar.tsx
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

type NavItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/dashboard/profile", label: "Mon profil", icon: User2 },
  { href: "/dashboard/progress", label: "Mes progrès", icon: LineChart },
  { href: "/dashboard/corrector", label: "Files te corrige", icon: Wand2 },
  { href: "/dashboard/recipes", label: "Recettes", icon: BookOpen },
  { href: "/dashboard/calories", label: "Calories", icon: Flame },
  { href: "/dashboard/connect", label: "Connecte tes données", icon: Plug2 },
  { href: "/dashboard/bmi", label: "IMC", icon: ClipboardList },
  { href: "/dashboard/motivation", label: "Motivation", icon: MessageCircle },
  { href: "/dashboard/music", label: "Musique", icon: Music2 },
  { href: "/dashboard/avis", label: "Votre avis", icon: MessageCircle },
  { href: "/dashboard/settings", label: "Réglages", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"fr" | "en">("fr");

  // Replier le menu à chaque changement de route
  useEffect(() => setOpen(false), [pathname]);

  // Lire la langue actuelle depuis le cookie (pour mettre le bouton actif)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const match = document.cookie.match(/(?:^|;\s*)fc-lang=(fr|en)/);
    if (match) {
      setLang(match[1] as "fr" | "en");
    }
  }, []);

  // Fermer APRÈS que le clic ait été géré par <Link>
  const closeAfterClick = () => {
    requestAnimationFrame(() => setOpen(false));
  };

  // Change la langue via cookie + reload
  const changeLang = (newLang: "fr" | "en") => {
    try {
      document.cookie = [
        `fc-lang=${newLang}`,
        "Path=/",
        "SameSite=Lax",
        "Max-Age=31536000", // 1 an
      ].join("; ");
      setLang(newLang);
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
                border: lang === "fr" ? "1px solid #16a34a" : "1px solid #d1d5db",
                fontSize: 11,
                background: lang === "fr" ? "#dcfce7" : "#fff",
                color: lang === "fr" ? "#166534" : "#374151",
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
                border: lang === "en" ? "1px solid #16a34a" : "1px solid #d1d5db",
                fontSize: 11,
                background: lang === "en" ? "#dcfce7" : "#fff",
                color: lang === "en" ? "#166534" : "#374151",
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
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
