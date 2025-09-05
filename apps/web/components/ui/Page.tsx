import React from "react";

export function PageHeader({ title, subtitle, cta }: { title: string; subtitle?: string; cta?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="lead">{subtitle}</p>}
      </div>
      {cta && <div className="actions">{cta}</div>}
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {right}
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}

export function CTA({ href = "#", children }: { href?: string; children: React.ReactNode }) {
  return (
    <a className="cta" href={href}>
      {children}
    </a>
  );
}
