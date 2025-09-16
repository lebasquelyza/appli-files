export function getBaseUrl() {
  return process.env.APP_BASE_URL
      || process.env.NEXTAUTH_URL
      || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
      || "http://localhost:3000";
}
