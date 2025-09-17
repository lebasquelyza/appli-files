import * as React from "react";

type Variant = "default" | "secondary" | "destructive" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  className?: string;
};

const VARIANT_STYLES: Record<Variant, string> = {
  default:
    "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50 disabled:pointer-events-none",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none",
  ghost:
    "bg-transparent text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none",
};

export function Button({
  children,
  className = "",
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-md transition ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
