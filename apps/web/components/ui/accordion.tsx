"use client";
import * as React from "react";

type ItemState = Record<string, boolean>;

export function Accordion({
  type = "single",
  collapsible = false,
  children,
  className = "",
}: {
  type?: "single" | "multiple";
  collapsible?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState<ItemState>({});
  const toggle = (id: string) =>
    setOpen((s) => {
      const isOpen = !!s[id];
      if (type === "single") {
        if (isOpen && collapsible) return {};
        return { [id]: true };
      }
      return { ...s, [id]: !isOpen };
    });
  return (
    <div className={`w-full ${className}`}>
      {React.Children.map(children, (child: any) =>
        React.cloneElement(child, { __open: open, __toggle: toggle })
      )}
    </div>
  );
}

export function AccordionItem({
  value,
  children,
  className = "",
  __open,
  __toggle,
}: React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  __open?: ItemState;
  __toggle?: (id: string) => void;
}) {
  return (
    <div className={`rounded-lg border ${className}`} data-value={value}>
      {React.Children.map(children as any, (child: any) =>
        React.cloneElement(child, {
          __isOpen: !!__open?.[value],
          __toggle: () => __toggle?.(value),
        })
      )}
    </div>
  );
}

export function AccordionTrigger({
  children,
  className = "",
  __isOpen,
  __toggle,
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  __isOpen?: boolean;
  __toggle?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={__toggle}
      className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium ${className}`}
      aria-expanded={__isOpen}
    >
      {children}
      <span className={`ml-2 transition-transform ${__isOpen ? "rotate-180" : ""}`}>▾</span>
    </button>
  );
}

export function AccordionContent({
  children,
  className = "",
  __isOpen,
}: React.HTMLAttributes<HTMLDivElement> & {
  __isOpen?: boolean;
}) {
  if (!__isOpen) return null;
  return <div className={`px-3 pb-3 text-sm text-gray-700 ${className}`}>{children}</div>;
}
