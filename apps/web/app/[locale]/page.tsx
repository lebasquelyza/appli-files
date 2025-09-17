// app/[locale]/page.tsx
export default function HomePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Bienvenue 👋</h1>
      <p style={{color:"var(--muted)"}}>
        Ceci est la page d’accueil localisée. Essaie /fr, /en ou /de.
      </p>
    </main>
  );
}
