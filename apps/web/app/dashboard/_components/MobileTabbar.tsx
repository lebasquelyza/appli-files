// apps/web/app/dashboard/_components/MobileTabbar.tsx
"use client";

export default function MobileTabbar() {
  return (
    <footer
      role="contentinfo"
      className="
        fixed inset-x-0 bottom-0 z-30 lg:hidden
        border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80
      "
    >
      <div className="w-full flex items-center justify-center px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        <span className="text-xs text-gray-500 font-medium">
          Files Coaching 2025
        </span>
      </div>
    </footer>
  );
}
