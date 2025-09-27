// apps/web/app/dashboard/_components/MobileTabbar.tsx
"use client";

export default function MobileTabbar() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div
        className="mx-auto max-w-screen-sm h-14 flex items-center justify-center px-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <span className="text-xs font-semibold text-gray-800">
          Files Coaching 2025
        </span>
      </div>
    </footer>
  );
}
