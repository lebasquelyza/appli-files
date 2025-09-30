"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    _pushReady?: boolean;
  }
}

export default function RegisterSW() {
  useEffect(() => {
    if (window._pushReady) return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        // Next exporte le dossier /public à la racine
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        window._pushReady = true;
        // rien d’autre ici : la souscription se fait depuis la page Réglages
      } catch (e) {
        console.error("SW register error", e);
      }
    };

    register();
  }, []);

  return null;
}
