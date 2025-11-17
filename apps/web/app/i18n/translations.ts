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
  },
} as const;
