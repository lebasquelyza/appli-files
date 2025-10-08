"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronDown, Home, User2, LineChart, Wand2, BookOpen,
  Flame, Plug2, CreditCard, ClipboardList, Music2, Settings,
} from "lucide-react";

type NavItem = { href: string; label: string; icon?: React.ComponentType<{ size?: number }> };

const items: NavItem[] = [
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
  const router = useRouter();
  const pathname = usePathname();

  // Toujours fermé par défaut
  const [open, setOpen] = useState(false);

  // Fermer quand la route change (fallback)
  useEffect(() => { setOpen(false); }, [pathname]);

  // Nav contrôlée: ferme D'ABORD, puis push
  const handleNav = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    // push juste après pour être certain que l'état est appliqué
    // (et éviter un éventuel re-toggle visuel)
    setTimeout(() => {
      if (pathname !== href) router.push(href);
    }, 0);
  };

  return (
    <nav aria-label="Dashboard" className="px-[10px]">
      {/* Entête sticky */}
      <div
        className="sticky top-0 z-10 pb-2"
        style={{
          background: "linear-gradient(180deg,#fff 70%,rgba(255,255,255,0) 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-3 px-2 pt-3">
          {/* Icône verte non interactive */}
          <span
            aria-hidden
            className="inline-block h-8 w-8 rounded-xl shadow"
            style={{
              background: "linear-gradient(135deg,var(--brand,#22c55e),var(--brand2,#15803d))",
            }}
          />
          {/* 👉 Seul ce bouton ouvre/ferme */}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls="sidebar-links"
            className="inline-flex items-center gap-1 font-bold text-base text-blue-600 hover:underline focus:outline-none"
          >
            Files&nbsp;-&nbsp;Menu
            <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Liste cachée si fermé */}
      <ul
        id="sidebar-links"
        className={open ? "block" : "hidden"}
        style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: "calc(100dvh - 80px)", overflowY: "auto" }}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              {/* Link pour préfetch SEO, mais on contrôle le clic */}
              <Link href={href} onClick={handleNav(href)} className="block font-semibold no-underline">
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
                    boxShadow: active ? "var(--shadow, 0 10px 20px rgba(0,0,0,.08))" : "none",
                    color: active ? "#fff" : "var(--text, #111)",
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
