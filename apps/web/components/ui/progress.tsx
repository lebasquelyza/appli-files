import * as React from "react";

export function Progress({ value = 0, className = "" }: { value?: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full h-2 rounded-full bg-gray-200 overflow-hidden ${className}`}>
      <div
        className="h-full bg-blue-600 transition-[width]"
        style={{ width: `${v}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        role="progressbar"
      />
    </div>
  );
}
