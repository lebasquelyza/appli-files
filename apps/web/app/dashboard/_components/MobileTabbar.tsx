// apps/web/app/dashboard/_components/MobileTabbar.tsx
"use client";

export default function MobileTabbar() {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
      style={{ WebkitBackdropFilter: "saturate(180%) blur(8px)" }}
    >
      <div
        className="w-full h-14 flex items-center justify-start px-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <p className="text-xs font-semibold text-gray-900 text-left">
          Files Coaching 2025
        </p>
      </div>
    </footer>
  );
}
