export default function TestSpotify() {
  const absoluteStart =
    "https://appli-files.netlify.app/api/auth/signin/spotify?callbackUrl=%2Fdashboard%2Fmusic";
  const relativeStart = "/api/auth/signin/spotify?callbackUrl=%2Fdashboard%2Fmusic";

  return (
    <main style={{ padding: 24, maxWidth: 640, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>Test OAuth Spotify (sans JS)</h1>
      <ol>
        <li>
          <a href={relativeStart}>Démarrer via lien <b>relatif</b></a>
        </li>
        <li style={{ marginTop: 12 }}>
          <a href={absoluteStart}>Démarrer via lien <b>absolu</b></a>
        </li>
        <li style={{ marginTop: 12 }}>
          <a href="/api/auth/signin">Voir la page NextAuth /signin</a>
        </li>
        <li style={{ marginTop: 12 }}>
          <a href="/api/auth/providers">Voir le JSON des providers</a>
        </li>
      </ol>
      <p style={{ marginTop: 24, fontSize: 14, opacity: 0.8 }}>
        Clique sur les liens et note le message d’erreur (ou si le consentement Spotify s’ouvre).
      </p>
    </main>
  );
}


