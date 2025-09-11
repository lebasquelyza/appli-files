export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  return (
    <div className="container" style={{ padding: 32 }}>
      <h1>Test Recettes OK ✅</h1>
      <p>Si tu vois ce message, la route <code>/dashboard/recipes</code> fonctionne.</p>
      <a className="btn btn-dash" href="/dashboard">← Retour Dashboard</a>
    </div>
  );
}
