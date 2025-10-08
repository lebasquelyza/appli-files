"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Home, User2, LineChart, Wand2, BookOpen, Flame, Plug2, CreditCard, ClipboardList, Music2, Settings } from "lucide-react";

type NavItem = { href: string; label: string; icon?: React.ComponentType<{ size?: number; className?: string }> };

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
  const pathname = usePathname();

  // ouvert en desktop, fermé par défaut en mobile
  const [open, setOpen] = useState(false);

  // media query (md)
  const mql = useMemo(
    () => (typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)") : null),
    []
  );

  // sync initiale + au resize
  useEffect(() => {
    if (!mql) return;
    const sync = () => setOpen(mql.matches);
    sync();
    mql.addEventListener?.("change", sync);
    return () => mql.removeEventListener?.("change", sync);
  }, [mql]);

  // refermer auto après navigation (mobile)
  useEffect(() => {
    if (!mql || mql.matches) return;
    setOpen(false);
  }, [pathname, mql]);

  const handleLinkClick = () => {
    if (!mql || mql.matches) return; // desktop => ne pas refermer
    setOpen(false);
  };

  return (
    <nav aria-label="Dashboard" className="px-[10px]">
      {/* ===== Header sticky : "Files - Menu" (design comme ta capture) ===== */}
      <div
        className="sticky top-0 z-10 pb-3"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,1) 70%, rgba(255,255,255,0) 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="sidebar-links"
          className="w-full flex items-center gap-3 px-2 pt-3 pb-1 rounded-md hover:bg-gray-50 md:hover:bg-transparent md:cursor-default md:pointer-events-none"
          style={{ textAlign: "left" }}
        >
          {/* carré dégradé comme l’avatar de la capture */}
          <span
            aria-hidden
            className="inline-block h-8 w-8 rounded-xl shadow"
            style={{
              background: "linear-gradient(135deg,var(--brand,#22c55e),var(--brand2,#15803d))",
            }}
          />
          <b className="text-xl leading-none">Files - Menu</b>
          {/* chevron visible uniquement en mobile */}
          <ChevronDown
            size={16}
            className={`ml-auto transition-transform md:hidden ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* ===== Liste des liens : cachée en mobile tant que non ouverte ===== */}
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
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                onClick={handleLinkClick}
                aria-current={active ? "page" : undefined}
                className="block font-semibold no-underline"
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
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}



