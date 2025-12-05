import * as React from "react";

export function Card({ children, className = "" }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border bg-white p-4 shadow ${className}`}>{children}</div>;
}

export function CardHeader({ children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="mb-2 font-semibold">{children}</div>;
}

export function CardTitle({ children }: React.HTMLAttributes<HTMLDivElement>) {
  return <h3 className="text-lg font-bold">{children}</h3>;
}

export function CardContent({ children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="text-sm">{children}</div>;
}
