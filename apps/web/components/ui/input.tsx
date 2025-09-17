import * as React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full rounded-md border p-2 text-sm ${className}`}
    {...props}
  />
));
Input.displayName = "Input";
