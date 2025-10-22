// apps/web/app/_debug/cookies/page.tsx
import { cookies } from "next/headers";

export default async function DebugCookiesPage() {
  const all = cookies().getAll();
  return (
    <main style={{padding: 20, fontFamily: "ui-sans-serif, system-ui"}}>
      <h1 style={{fontSize: 20, fontWeight: 600}}>Cookies (server)</h1>
      {!all.length ? (
        <p>Aucun cookie.</p>
      ) : (
        <table style={{marginTop: 12, borderCollapse: "collapse"}}>
          <thead>
            <tr>
              <th style={{textAlign:"left", padding: "6px 8px", borderBottom:"1px solid #ddd"}}>Name</th>
              <th style={{textAlign:"left", padding: "6px 8px", borderBottom:"1px solid #ddd"}}>Value</th>
              <th style={{textAlign:"left", padding: "6px 8px", borderBottom:"1px solid #ddd"}}>HttpOnly</th>
              <th style={{textAlign:"left", padding: "6px 8px", borderBottom:"1px solid #ddd"}}>Secure</th>
              <th style={{textAlign:"left", padding: "6px 8px", borderBottom:"1px solid #ddd"}}>Path</th>
              <th style={{textAlign:"left", padding: "6px 8px", borderBottom:"1px solid #ddd"}}>SameSite</th>
              <th style={{textAlign:"left", padding: "6px 8px", borderBottom:"1px solid #ddd"}}>Domain</th>
            </tr>
          </thead>
          <tbody>
            {all.map(c => (
              <tr key={c.name}>
                <td style={{padding:"6px 8px"}}>{c.name}</td>
                <td style={{padding:"6px 8px", maxWidth: 420, overflowWrap:"anywhere"}}>{c.value}</td>
                <td style={{padding:"6px 8px"}}>{String(c.httpOnly)}</td>
                <td style={{padding:"6px 8px"}}>{String(c.secure)}</td>
                <td style={{padding:"6px 8px"}}>{c.path ?? "/"}</td>
                <td style={{padding:"6px 8px"}}>{String(c.sameSite ?? "lax")}</td>
                <td style={{padding:"6px 8px"}}>{c.domain ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{marginTop: 12, color:"#666"}}>⚠️ Pense à supprimer cette page après debug.</p>
    </main>
  );
}
