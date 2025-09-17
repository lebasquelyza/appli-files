import * as React from "react";

export function Badge({ children, className = "" }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800 ${className}`}
    >
      {children}
    </span>
  );
}
