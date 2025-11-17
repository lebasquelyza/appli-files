// apps/web/app/i18n/translations.ts
export const translations = {
  fr: {
    home: {
      hero: {
        titleLine1: "Files Coaching —",
        titleLine2: "Coach Sportif IA",
        subtitle: "Séances personnalisées, conseils et suivi",
        bullets: {
          program: "✅ Programme personnalisé adapté à vos objectifs",
          timerMusic: "✅ Minuteur & Musique intégrés pour vos séances",
          recipes: "✅ Recettes healthy & conseils nutrition",
        },
      },
      cta: {
        login: "Connecte-toi",
        signup: "Créer un compte",
      },
      login: {
        emailLabel: "Adresse e-mail",
        emailPlaceholder: "vous@exemple.com",
        passwordLabel: "Mot de passe",
        passwordPlaceholder: "••••••••",
        submitLoading: "Connexion...",
        submitIdle: "Se connecter",
        forgotPassword: "Mot de passe oublié ?",
        success: "Connexion réussie ✅",
        error: {
          invalidCredentials:
            "Identifiants invalides. Vérifie l’e-mail/mot de passe, ou confirme ton e-mail.",
          generic: "Impossible de se connecter",
        },
      },
      signup: {
        emailLabel: "Adresse e-mail",
        emailPlaceholder: "vous@exemple.com",
        passwordLabel: "Mot de passe",
        passwordPlaceholder: "••••••••",
        submitLoading: "Création du compte...",
        submitIdle: "Créer mon compte",
        success:
          "Compte créé ✅ Vérifie tes e-mails pour confirmer ton inscription.",
        error: {
          invalidEmail: "E-mail invalide ou déjà utilisé.",
          generic: "Impossible de créer le compte",
        },
      },
      forgotPassword: {
        noEmail: "Entrez votre e-mail pour réinitialiser votre mot de passe.",
        success: "E-mail de réinitialisation envoyé 📩",
        error: "Erreur lors de la réinitialisation",
      },
    },
    common: {
      password: {
        show: "Afficher le mot de passe",
        hide: "Masquer le mot de passe",
      },
    },
    settings: {
      pageTitle: "Réglages",
      sections: {
        general: "Général",
        motivationReminder: "Rappel Motivation ",
        legal: "Cookies & Mentions légales",
      },
      language: {
        title: "Langue",
        options: {
          fr: "Français (FR)",
          en: "English (EN)",
          de: "Deutsch (DE)",
        },
      },
      deleteAccount: {
        title: "Supprimer mon compte",
        questionLabel: "Pourquoi partez-vous ? (facultatif)",
        reasons: {
          no_longer_needed: "Je n’en ai plus besoin",
          missing_features: "Il manque des fonctionnalités",
          too_expensive: "Trop cher / pas rentable",
          privacy_concerns: "Inquiétudes liées aux données",
          bugs_or_quality: "Bugs / qualité insatisfaisante",
          other: "Autre…",
        },
        otherPlaceholder: "Dites-nous en plus (optionnel)",
        irreversibleText:
          "Cette action est irréversible : vos données et accès seront supprimés. Pour confirmer, tapez",
        confirmPlaceholder: "SUPPRIMER",
        alerts: {
          needRelogin:
            "Veuillez vous reconnecter avant de supprimer votre compte.",
          success: "Votre compte a été supprimé. Au revoir 👋",
          errorGeneric: "Impossible de supprimer le compte",
          errorDuringDelete: "Erreur lors de la suppression",
        },
        button: {
          loading: "Suppression…",
          idle: "Supprimer définitivement",
        },
        confirmFieldAria: "Champ de confirmation de suppression",
      },
      pushSchedule: {
        cardTitle: "Rappel planifié",
        timezoneLabel: "Fuseau : {{tz}}",
        saveButton: "Enregistrer",
        alerts: {
          success: "Rappel enregistré ✅",
          error: "Erreur d’enregistrement",
        },
        daysDropdown: {
          buttonLabel: "Jours",
          ariaLabel: "Sélection des jours",
          labelsFull: [
            "Lundi",
            "Mardi",
            "Mercredi",
            "Jeudi",
            "Vendredi",
            "Samedi",
            "Dimanche",
          ],
          ok: "OK",
          clearAll: "Tout vider",
        },
        timeDropdown: {
          buttonLabel: "Heure",
          ariaLabel: "Sélection de l'heure",
          ok: "OK",
        },
      },
      legal: {
        openButton: "Voir les mentions légales",
        modalAriaLabel: "Mentions légales et politique de cookies",
        title: "Mentions légales",
        close: "Fermer",
        cookiesTitle: "Cookies",
        introText:
          "Les informations relatives aux mentions légales du site seront bientôt disponibles. Nous mettons tout en œuvre pour publier ces éléments dans les meilleurs délais.",
        cookiesText:
          "La politique de gestion des cookies est actuellement en cours de rédaction et sera publiée prochainement. Nous vous remercions pour votre compréhension.",
        sectionIntro:
          "Les informations relatives aux cookies et aux mentions légales seront prochainement disponibles.",
      },
      logout: {
        ariaLabel: "Se déconnecter",
        loading: "Déconnexion…",
        idle: "Se déconnecter",
        error: "Déconnexion impossible",
      },
      seance: {
  fallback: {
    defaultTitle: "Séance",
    detailUnavailable: "Détail indisponible — regénère ton programme depuis le profil.",
    minSuffix: "min",
  },
  mode: {
    equip: {
      label: "Avec équipement",
      title: "Version avec équipement",
    },
    noequip: {
      label: "Sans équipement",
      title: "Version sans équipement",
    },
  },
  exercise: {
    setsUnit: "séries",
    restPrefix: "Repos",
    tempoPrefix: "Tempo",
    rirPrefix: "RIR",
    bodyweight: "poids du corps",
  },
  backLink: "← Retour au profil",
},
  },
  },
  en: {
    home: {
      hero: {
        titleLine1: "Files Coaching —",
        titleLine2: "AI Fitness Coach",
        subtitle: "Personalized workouts, guidance and tracking",
        bullets: {
          program: "✅ Personalized program tailored to your goals",
          timerMusic: "✅ Built-in timer & music for your sessions",
          recipes: "✅ Healthy recipes & nutrition advice",
        },
      },
      cta: {
        login: "Log in",
        signup: "Create an account",
      },
      login: {
        emailLabel: "Email address",
        emailPlaceholder: "you@example.com",
        passwordLabel: "Password",
        passwordPlaceholder: "••••••••",
        submitLoading: "Logging in...",
        submitIdle: "Log in",
        forgotPassword: "Forgot your password?",
        success: "Successfully signed in ✅",
        error: {
          invalidCredentials:
            "Invalid credentials. Check your email/password or confirm your email.",
          generic: "Unable to sign in",
        },
      },
      signup: {
        emailLabel: "Email address",
        emailPlaceholder: "you@example.com",
        passwordLabel: "Password",
        passwordPlaceholder: "••••••••",
        submitLoading: "Creating account...",
        submitIdle: "Create my account",
        success:
          "Account created ✅ Check your emails to confirm your registration.",
        error: {
          invalidEmail: "Invalid or already used email.",
          generic: "Unable to create account",
        },
      },
      forgotPassword: {
        noEmail: "Enter your email to reset your password.",
        success: "Reset email sent 📩",
        error: "Error while resetting password",
      },
    },
    common: {
      password: {
        show: "Show password",
        hide: "Hide password",
      },
    },
    settings: {
      pageTitle: "Settings",
      sections: {
        general: "General",
        motivationReminder: "Motivation reminder",
        legal: "Cookies & Legal notice",
      },
      language: {
        title: "Language",
        options: {
          fr: "French (FR)",
          en: "English (EN)",
          de: "German (DE)",
        },
      },
      deleteAccount: {
        title: "Delete my account",
        questionLabel: "Why are you leaving? (optional)",
        reasons: {
          no_longer_needed: "I don’t need it anymore",
          missing_features: "Missing features",
          too_expensive: "Too expensive / not worth it",
          privacy_concerns: "Data & privacy concerns",
          bugs_or_quality: "Bugs / unsatisfying quality",
          other: "Other…",
        },
        otherPlaceholder: "Tell us more (optional)",
        irreversibleText:
          "This action is irreversible: your data and access will be deleted. To confirm, type",
        confirmPlaceholder: "DELETE",
        alerts: {
          needRelogin: "Please log in again before deleting your account.",
          success: "Your account has been deleted. Goodbye 👋",
          errorGeneric: "Unable to delete the account",
          errorDuringDelete: "Error while deleting the account",
        },
        button: {
          loading: "Deleting…",
          idle: "Delete permanently",
        },
        confirmFieldAria: "Account deletion confirmation field",
      },
      pushSchedule: {
        cardTitle: "Scheduled reminder",
        timezoneLabel: "Timezone: {{tz}}",
        saveButton: "Save",
        alerts: {
          success: "Reminder saved ✅",
          error: "Error while saving",
        },
        daysDropdown: {
          buttonLabel: "Days",
          ariaLabel: "Day selection",
          labelsFull: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
          ok: "OK",
          clearAll: "Clear all",
        },
        timeDropdown: {
          buttonLabel: "Time",
          ariaLabel: "Time selection",
          ok: "OK",
        },
      },
      legal: {
        openButton: "View legal notice",
        modalAriaLabel: "Legal notice and cookie policy",
        title: "Legal notice",
        close: "Close",
        cookiesTitle: "Cookies",
        introText:
          "The information related to the legal notice of the site will be available soon. We are working to publish these details as soon as possible.",
        cookiesText:
          "The cookie policy is currently being drafted and will be published shortly. Thank you for your understanding.",
        sectionIntro:
          "Information about cookies and legal notice will be available soon.",
      },
      logout: {
        ariaLabel: "Log out",
        loading: "Logging out…",
        idle: "Log out",
        error: "Unable to log out",
      },
      seance: {
  fallback: {
    defaultTitle: "Session",
    detailUnavailable: "Details unavailable — regenerate your program from the profile page.",
    minSuffix: "min",
  },
  mode: {
    equip: {
      label: "With equipment",
      title: "Version with equipment",
    },
    noequip: {
      label: "Bodyweight only",
      title: "Version without equipment",
    },
  },
  exercise: {
    setsUnit: "sets",
    restPrefix: "Rest",
    tempoPrefix: "Tempo",
    rirPrefix: "RIR",
    bodyweight: "bodyweight",
  },
  backLink: "← Back to profile",
},

    },
  },
} as const;
