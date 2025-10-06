"use client";

import { usePathname } from "next/navigation";
import Topbar from "../components/Topbar";

export default function TopbarGate() {
  const p = (usePathname() || "/").replace(/\/+$/, ""); // retire le slash final
  // cacher la topbar sur /, /signin, /signup
  const hide = p === "" || p === "/" || p === "/signin" || p === "/signup";

  // optionnel: ajuste le padding global défini dans layout
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--topbar-h", hide ? "0px" : "40px");
  }

  if (hide) return null;
  return <Topbar />;
}
