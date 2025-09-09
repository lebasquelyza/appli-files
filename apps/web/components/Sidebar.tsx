"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/dashboard/profile", label: "Mon profil" },
  { href: "/dashboard/progress", label: "Mes progrès" },
  { href: "/dashboard/corrector", label: "Files te corrige" },
  { href: "/dashboard/recipes", label: "Recettes" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/connect", label: "Connecte tes données" },
  { href: "/dashboard/pricing", label: "Abonnement" },
  { href: "/dashboard/bmi", label: "IMC" },
  { href: "/dashboard/music", label: "Musique" },
  { href: "/dashboard/settings", label: "Réglages" }
];

export default function Sidebar(){
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" style={{padding:10}}>
      <div className="brand" style={{gap:10, padding:"10px 8px"}}>
        <span className="mark" />
        <b>Files</b>
      </div>
      <ul style={{listStyle:"none", padding:0, margin:0}}>
        {items.map(it=>{
          const active = pathname === it.href;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                style={{
                  display:"block", padding:"10px 12px", borderRadius:10, margin:"4px 6px",
                  fontWeight:600, textDecoration:"none",
                  background: active ? "linear-gradient(135deg,var(--brand),var(--brand2))" : "transparent",
                  border: active ? "1px solid rgba(22,163,74,.25)" : "1px solid transparent",
                  boxShadow: active ? "var(--shadow)" : "none",
                  color: active ? "#fff" : "#111"
                }}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
