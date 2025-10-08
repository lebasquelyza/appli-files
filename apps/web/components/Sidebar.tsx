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
  { href: "/dashboard/pricing", label: "Abonnement", icon: CreditCard },
  { href: "/dashboard/bmi", label: "IMC", icon: ClipboardList },
  { href: "/dashboard/music", label: "Musique", icon: Music2 },
  { href: "/dashboard/settings", label: "Réglages", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // fermé par défaut

  // filet de sécurité : replier à chaque changement de route
  useEffect(() => setOpen(false), [pathname]);

  return (
    <nav aria-label="Dashboard" className="px-[10px]">
      {/* ===== Entête sticky tout en haut à gauche ===== */}
      <div
        className="sticky top-0 z-10 pb-2"
        style={{
          background: "linear-gradient(180deg,#fff 70%,rgba(255,255,255,0) 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="sidebar-links"
          className="w-full flex items-center gap-3 px-2 pt-3 pb-1 rounded-md text-left hover:bg-gray-50 focus:outline-none"
        >
          {/* Carré dégradé (statique / non interactif) */}
          <span
            aria-hidden
            className="inline-block h-8 w-8 rounded-xl shadow"
            style={{
              background:
                "linear-gradient(135deg,var(--brand,#22c55e),var(--brand2,#15803d))",
            }}
          />
          {/* 👉 “Files” = bouton d’ouverture */}
          <b className="text-xl leading-none">Files</b>
          <ChevronDown
            size={16}
            className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* ===== Liste complète — masquée tant que fermé ===== */}
      <ul
        id="sidebar-links"
        className={open ? "block" : "hidden"}
        // ferme AVANT la navigation (fiable iOS/Safari)
        onPointerDownCapture={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest("a[href]")) setOpen(false);
        }}
        style={{
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
              <Link href={href} className="block no-underline font-semibold">
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
                      ? "var(--shadow, 0 10px 20px rgba(0,0,0,.08))"
                      : "none",
                    color: active ? "#fff" : "var(--text,#111)",
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
