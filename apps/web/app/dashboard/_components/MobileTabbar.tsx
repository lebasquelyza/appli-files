// apps/web/app/dashboard/_components/MobileTabbar.tsx
"use client";

export default function MobileTabbar() {
  return (
    <footer
      className="border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80
                 text-center px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)]"
      role="contentinfo"
    >
      <span className="text-xs text-gray-500 font-medium">
        Files Coaching 2025
      </span>
    </footer>
  );
}
