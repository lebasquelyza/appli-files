"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const items: Item[] = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/dashboard/profile", label: "Mon profil", icon: User2 },
  { href: "/dashboard/progress", label: "Mes progrès", icon: LineChart },
  { href: "/dashboard/corrector", label: "Files te corrige", icon: Wand2 },
  { href: "/dashboard/recipes", label: "Recettes", icon: BookOpen },
  { href: "/dashboard/calories", label: "Calories", icon: Flame },
  { href: "/dashboard/connect", label: "Connecte tes données", icon: Plug2 }, // ✅ ici
  { href: "/dashboard/pricing", label: "Abonnement", icon: CreditCard },
  { href: "/dashboard/bmi", label: "IMC", icon: ClipboardList },
  { href: "/dashboard/music", label: "Musique", icon: Music2 },
  { href: "/dashboard/settings", label: "Réglages", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" style={{ padding: 10 }}>
      <div
        className="brand"
        style={{
          gap: 10,
          padding: "10px 8px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span className="mark" />
        <b>Files</b>
      </div>

      {/* Scroll si la liste déborde (petits écrans) */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          maxHeight: "calc(100dvh - 80px)",
          overflowY: "auto",
        }}
      >
        {items.map((it) => {
          const active =
            pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  margin: "4px 6px",
                  fontWeight: 600,
                  textDecoration: "none",
                  // ✅ couleurs lisibles clair/sombre
                  background: active
                    ? "linear-gradient(135deg,var(--brand),var(--brand2))"
                    : "transparent",
                  border: active
                    ? "1px solid rgba(22,163,74,.25)"
                    : "1px solid transparent",
                  boxShadow: active ? "var(--shadow)" : "none",
                  color: active ? "white" : "var(--text, #111)",
                }}
              >
                <Icon size={18} />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

