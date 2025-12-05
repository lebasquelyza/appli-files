"use client";
import * as React from "react";

type TabsContext = {
  value: string;
  setValue: (v: string) => void;
};
const Ctx = React.createContext<TabsContext | null>(null);

export function Tabs({
  defaultValue,
  value: valueProp,
  onValueChange,
  children,
  className = "",
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const value = valueProp ?? internal;
  const setValue = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <div className={className}>
      <Ctx.Provider value={{ value, setValue }}>{children}</Ctx.Provider>
    </div>
  );
}

export function TabsList({ children, className = "" }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`inline-flex rounded-md border p-1 ${className}`}>{children}</div>;
}

export function TabsTrigger({
  value,
  children,
  className = "",
}: { value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={`px-3 py-1.5 text-sm rounded-md transition ${
        active ? "bg-black text-white" : "bg-transparent text-gray-700 hover:bg-gray-100"
      } ${className}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = "",
  ...rest
}: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}
