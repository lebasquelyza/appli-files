import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.filescoaching.app',
  appName: 'Files Coaching',
  webDir: 'public', // peu importe, ignoré si server.url est défini
  server: {
    url: 'https://appli.files-coaching.com', // ← remplace par ton URL
    cleartext: false
  }
};
export default config;
