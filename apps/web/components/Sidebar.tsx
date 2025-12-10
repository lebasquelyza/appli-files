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
import { useLanguage } from "@/components/LanguageProvider";

type NavItem = {
  href: string;
  label: {
    fr: string;
    en: string;
  };
  icon?: React.ComponentType<{ size?: number }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: { fr: "Accueil",       en: "Home" },           icon: Home },
  { href: "/dashboard/profile", label: { fr: "Mon profil",   en: "My profile" },     icon: User2 },
  { href: "/dashboard/progress", label: { fr: "Mes progrès",  en: "My progress" },    icon: LineChart },
  { href: "/dashboard/corrector", label: { fr: "Files te corrige", en: "Files corrects you" }, icon: Wand2 },
  { href: "/dashboard/recipes", label: { fr: "Recettes",     en: "Recipes" },       icon: BookOpen },
  { href: "/dashboard/calories", label: { fr: "Calories",     en: "Calories" },      icon: Flame },
  {
    href: "/dashboard/connect",
    label: { fr: "Connecte tes données", en: "Connect your data" },
    icon: Plug2,
  },
  { href: "/dashboard/bmi", label: { fr: "IMC",          en: "BMI" },           icon: ClipboardList },
  { href: "/dashboard/motivation", label: { fr: "Motivation",   en: "Motivation" },    icon: MessageCircle },
  { href: "/dashboard/music", label: { fr: "Musique",      en: "Music" },         icon: Music2 },
  { href: "/dashboard/avis", label: { fr: "Votre avis",   en: "Feedback" },      icon: MessageCircle },
  { href: "/dashboard/settings", label: { fr: "Réglages",    en: "Settings" },     icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false); // 👈 état pour le chabrot

  const { lang, setLang } = useLanguage();

  // Replier le menu à chaque changement de route
  useEffect(() => setOpen(false), [pathname]);

  // Fermer APRÈS que le clic ait été géré par <Link>
  const closeAfterClick = () => {
    requestAnimationFrame(() => setOpen(false));
  };

  return (
    <>
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
          {/* Ligne : Files-Menu + bulle chabrot + FR/EN */}
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

            {/* 💬 Bulle chabrot juste à droite de Files-Menu */}
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              aria-label={
                chatOpen
                  ? "Fermer le chabrot intelligent"
                  : "Ouvrir le chabrot intelligent"
              }
              style={{
                height: 32,
                width: 32,
                borderRadius: 999,
                border: "1px solid #bbf7d0",
                background: "#ecfdf3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(0,0,0,.06)",
                fontSize: 16,
              }}
            >
              {/* tu peux remplacer par <MessageCircle size={16} /> si tu veux l'icône */}
              💬
            </button>

            {/* 🔤 Switch langue juste à côté de Files-Menu */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={() => setLang("fr")}
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
                onClick={() => setLang("en")}
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
            const text = lang === "fr" ? label.fr : label.en;

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
                    <span>{text}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 🔽 Panneau du chabrot intelligent (placeholder) */}
      {chatOpen && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 9999,
            width: "min(360px, 90vw)",
            height: 420,
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            background: "#fff",
            boxShadow: "0 18px 40px rgba(0,0,0,.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#f9fafb",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                Chabrot intelligent
              </span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                Bientôt ton assistant IA ici ✨
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Fermer le chabrot"
              style={{
                height: 24,
                width: 24,
                borderRadius: 999,
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6b7280",
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              flex: 1,
              padding: 10,
              fontSize: 13,
              color: "#374151",
              overflowY: "auto",
            }}
          >
            <p style={{ marginBottom: 8 }}>
              Le chabrot n&apos;est pas encore branché 🤖.<br />
              Tu pourras plus tard y intégrer ton vrai chatbot :
            </p>
            <ul
              style={{
                paddingLeft: 16,
                margin: 0,
                marginBottom: 12,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              <li>iframe vers un chatbot externe</li>
              <li>widget tiers (Crisp, Intercom, etc.)</li>
              <li>ou composant React maison avec l’API OpenAI</li>
            </ul>

            <div
              style={{
                marginTop: 8,
                border: "1px dashed #d1d5db",
                borderRadius: 10,
                padding: 10,
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              Zone réservée à ton futur chabrot 🧠
            </div>
          </div>
        </div>
      )}
    </>
  );
}
