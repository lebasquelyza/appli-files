export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  return (
    <div className="container" style={{ padding: 32 }}>
      <h1>Test Recettes OK ✅</h1>
      <p>Si tu vois ceci, la route <code>/dashboard/recipes</code> charge bien.</p>
      <a className="btn btn-dash" href="/dashboard">← Retour Dashboard</a>
    </div>
  );
}

