// apps/web/app/_debug/cookies/page.tsx
import { cookies } from "next/headers";

export default async function DebugCookiesPage() {
  // Next 14: RequestCookie[] → { name, value } uniquement
  const all = cookies().getAll();

  return (
    <main style={{ padding: 20, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Cookies (server)</h1>

      {!all.length ? (
        <p>Aucun cookie.</p>
      ) : (
        <table style={{ marginTop: 12, borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd" }}>Name</th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd" }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {all.map((c) => (
              <tr key={c.name}>
                <td style={{ padding: "6px 8px", verticalAlign: "top" }}>{c.name}</td>
                <td style={{ padding: "6px 8px", maxWidth: 700, overflowWrap: "anywhere" }}>{c.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: 12, color: "#666" }}>
        ℹ️ Les attributs (HttpOnly, Secure, Path, SameSite, Domain) ne sont pas exposés par <code>RequestCookie</code>.
        Pour les voir, inspecte l’onglet <b>Network</b> &rarr; entête <code>Set-Cookie</code> d’une réponse serveur.
      </p>
    </main>
  );
}
