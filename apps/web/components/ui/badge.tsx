import * as React from "react";

type Variant = "default" | "secondary" | "destructive" | "outline";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  className?: string;
};

const STYLES: Record<Variant, string> = {
  default: "bg-blue-600 text-white",
  secondary: "bg-gray-200 text-gray-800",
  destructive: "bg-red-600 text-white",
  outline: "bg-transparent border text-gray-900",
};

export function Badge({ children, variant = "default", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border border-transparent ${STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
