// apps/web/app/dashboard/_components/MobileTabbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Accueil", icon: "🏠" },
  { href: "/dashboard/calories", label: "Calories", icon: "🔥" },
  { href: "/dashboard/corrector", label: "IA", icon: "🧠" },
  { href: "/dashboard/profile", label: "Profil", icon: "💪" },
];

export default function MobileTabbar() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-4">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col items-center justify-center py-2 text-xs"
            aria-current={active ? "page" : undefined}
          >
            <span className={`leading-none ${active ? "opacity-100" : "opacity-60"}`}>{t.icon}</span>
            <span className={`mt-1 ${active ? "text-emerald-700 font-medium" : "text-gray-600"}`}>
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
