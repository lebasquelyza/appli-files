// app/i18n/translations.ts

export const translations = {
  fr: {
    common: {
      appName: "Files Coaching",
      menu: {
        dashboard: "Dashboard",
        sessions: "Séances",
        profile: "Profil",
        logout: "Se déconnecter",
      },
    },
    dashboard: {
      title: "Bienvenue 👋",
      subtitle: "Ravi de te revoir sur Files Coaching",
      caloriesToday: "Calories du jour",
      stepsToday: "Pas du jour",
      lastSession: "Dernière séance",
    },
    buttons: {
      startSession: "Commencer une séance",
      viewAllSessions: "Voir toutes les séances",
    },
  },

  en: {
    common: {
      appName: "Files Coaching",
      menu: {
        dashboard: "Dashboard",
        sessions: "Workouts",
        profile: "Profile",
        logout: "Log out",
      },
    },
    dashboard: {
      title: "Welcome 👋",
      subtitle: "Happy to see you back on Files Coaching",
      caloriesToday: "Calories today",
      stepsToday: "Steps today",
      lastSession: "Last workout",
    },
    buttons: {
      startSession: "Start a workout",
      viewAllSessions: "View all workouts",
    },
  },
} as const;

// ✅ Types exportés pour LanguageProvider
export type Lang = keyof typeof translations;
export type Messages = (typeof translations)["fr"];
