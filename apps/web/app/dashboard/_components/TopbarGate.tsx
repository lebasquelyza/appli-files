"use client";

import { usePathname } from "next/navigation";
// Depuis dashboard/_components → remonter vers app/components/Topbar
import Topbar from "../../components/Topbar";

export default function TopbarGate() {
  const p = (usePathname() || "/").replace(/\/+$/, ""); // retire le slash final
  // Cacher la topbar sur /, /signin, /signup
  const hide = p === "" || p === "/" || p === "/signin" || p === "/signup";

  // Ajuste la variable CSS utilisée dans le layout pour le padding top
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--topbar-h", hide ? "0px" : "40px");
  }

  if (hide) return null;
  return <Topbar />;
}

