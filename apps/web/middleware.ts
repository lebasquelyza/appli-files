export { default } from "next-auth/middleware";

// Exige la connexion sur /dashboard/** uniquement
export const config = {
  matcher: ["/dashboard/:path*"],
};
