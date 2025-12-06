// apps/web/app/dashboard/_components/MobileTabbar.tsx
"use client";

export default function MobileTabbar() {
  const height = 56; // hauteur visuelle (px) hors safe-area

  return (
    <footer
      role="contentinfo"
      aria-label="Barre mobile"
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden"
      style={{
        WebkitBackdropFilter: "saturate(180%) blur(8px)",
        ["--mobile-tabbar" as any]: `calc(${height}px + env(safe-area-inset-bottom))`,
      }}
    >
      <div
        className="w-full h-14 flex items-center justify-center mx-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <p className="text-xs font-semibold text-gray-900 text-center mx-auto">
          Files Coaching 2025
        </p>
      </div>
    </footer>
  );
}

