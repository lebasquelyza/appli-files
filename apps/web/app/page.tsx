"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-black px-4">
      <div className="text-center space-y-8">
        {/* Titre principal */}
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
          Bienvenue sur notre plateforme
        </h1>

        {/* Boutons d’action */}
        <div className="flex flex-col space-y-4 items-center">
          {/* Bouton Se connecter */}
          <Link
            href="/signin"
            className="px-8 py-3 rounded-full text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 transition-all shadow-md hover:shadow-blue-500/40"
          >
            Se connecter
          </Link>

          {/* Bouton Créer un compte — identique */}
          <Link
            href="/signup"
            className="px-8 py-3 rounded-full text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 transition-all shadow-md hover:shadow-blue-500/40"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </main>
  );
}
