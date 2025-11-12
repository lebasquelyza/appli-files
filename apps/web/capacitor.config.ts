// Pas d'import ici
const config = {
  appId: 'com.filescoaching.app',
  appName: 'Files Coaching',
  // adapte selon ton choix :
  // - si tu utilises l'URL Netlify en wrapper :
  webDir: 'public',
  server: {
    url: 'https://TON-SITE.netlify.app', // remplace par ton URL exacte en https
    cleartext: false
  }

  // - si tu embarques un export Next statique, utilise plutôt :
  // webDir: 'out'
} as const;

export default config;
