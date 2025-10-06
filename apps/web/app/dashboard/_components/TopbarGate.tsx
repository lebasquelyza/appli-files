"use client";

import { usePathname } from "next/navigation";
// depuis dashboard/_components → remonter à app/components/Topbar.tsx
import Topbar from "../../components/Topbar";

export default function TopbarGate() {
  const p = (usePathname() || "/").replace(/\/+$/, "");
  // cacher la topbar sur /, /signin, /signup
  const hide = p === "" || p === "/" || p === "/signin" || p === "/signup";

  // ajuste le padding global utilisé dans le layout
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--topbar-h", hide ? "0px" : "40px");
  }

  if (hide) return null; // rien à rendre sur ces 3 pages
  return <Topbar />;     // ailleurs: topbar normale
}
