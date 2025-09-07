export { default } from "next-auth/middleware";

// Protège tout SAUF les API, l'auth NextAuth, les assets et /sign-in
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sign-in).*)",
  ],
};
