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
    <nav
      className="border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80
                 px-2 pt-1 pb-[calc(env(safe-area-inset-bottom)+6px)] shadow-[0_-6px_16px_-8px_rgba(0,0,0,0.12)]"
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-4 gap-1">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-col items-center justify-center py-2 rounded-xl select-none"
              aria-current={active ? "page" : undefined}
            >
              <span className={`text-[18px] leading-none ${active ? "opacity-100" : "opacity-60"}`}>
                {t.icon}
              </span>
              <span
                className={`mt-1 text-[11px] tracking-tight ${
                  active ? "font-semibold text-black" : "text-gray-600"
                }`}
              >
                {t.label}
              </span>
              {/* pastille active */}
              <span
                className={`mt-1 h-1 w-6 rounded-full transition-all ${
                  active ? "bg-black opacity-90" : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
