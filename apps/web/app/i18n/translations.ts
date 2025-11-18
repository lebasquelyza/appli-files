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
      seancePage: {
  fallbackTitle: "Séance personnalisée",
  focus: {
    upper: "Haut du corps",
    lower: "Bas du corps",
    full: "Full body",
    mix: "Mix",
  },
  backButton: "← Retour",
  aiBadge: "Programme IA",
  plannedMinSuffix: "min",
  chips: {
    setsLabel: "Séries",
    repsLabel: "Rép./Durée",
    restLabel: "Repos",
  },
  errors: {
    notFound: "Seance introuvable",
  },
},recipes: {
  pageTitle: "Recettes",
  pageSubtitle: "Base healthy pour tous + suggestions perso IA selon tes filtres.",

  filters: {
    activeLabel: "Filtres actifs —",
    target: "cible",
    range: "plage",
    kcalSuffix: "kcal",
    allergens: "allergènes",
    dislikes: "non aimés",
    none: "aucun",
  },

  quickSwitch: {
    meals: {
      title: "Recettes — Healthy",
      subtitle: "Plats + bowls healthy",
    },
    shakes: {
      title: "Bar à prot’ — Boissons protéinées",
      subtitle: "Shakes/smoothies en 5 min",
    },
    activeBadge: "Actif",
  },

  constraints: {
    title: "Contraintes & filtres (pour l'IA)",
    kcalTargetLabel: "Cible calories (kcal)",
    kcalMinLabel: "Min kcal",
    kcalMaxLabel: "Max kcal",
    allergensLabel: "Allergènes / intolérances (séparés par virgules)",
    allergensPlaceholder: "arachide, lactose, gluten",
    dislikesLabel: "Aliments non aimés (re-travailler)",
    dislikesPlaceholder: "brocoli, saumon, tofu...",
    dislikesHelp: "L'IA les garde, mais propose une autre façon de les cuisiner.",
    footerNote: "Les filtres s'appliquent surtout aux suggestions perso IA.",
    resetButton: "Réinitialiser",
    regenerateButton: "Régénérer",
  },

  saved: {
    title: "Vos recettes enregistrées",
    removeButton: "Retirer",
  },

  mealsSection: {
    title: "Recettes",
    subtitle: "Recettes fixes, stables et testées.",
  },

  shakesSection: {
    title: "Boissons protéinées — base",
    subtitle: "Shakes & smoothies rapides.",
  },

  card: {
    viewRecipe: "Voir la recette",
    savedRemove: "Enregistrée ✓ (Retirer)",
    save: "Enregistrer",
  },
},aiSection: {
  title: "Suggestions perso IA",
  subtitle: "Générées en direct avec l'IA selon tes filtres.",
  unavailable: "IA indisponible pour le moment.",
  loading: "Génération en cours…",
  badge: "perso IA",
},progress: {
  pageTitle: "Mes progrès",
  pageSubtitle: "Ajoutez vos pas, vos charges et votre poids. Vos données restent en local (cookie).",

  messages: {
    saved: "✓ Entrée enregistrée.",
    deleted: "Entrée supprimée.",
    errorPrefix: "⚠️ Erreur :",
  },

  form: {
    title: "Ajouter une entrée",
    type: {
      label: "Type",
      steps: "Pas (steps)",
      load: "Charges portées (kg)",
      weight: "Poids (kg)",
      help: "Pour charges, vous pouvez renseigner les répétitions ci-dessous.",
    },
    date: {
      label: "Date",
    },
    value: {
      label: "Valeur",
      placeholder: "ex: 8000 (pas) / 60 (kg)",
    },
    reps: {
      label: "Répétitions (optionnel, charges)",
      placeholder: "ex: 8",
    },
    note: {
      label: "Note (optionnel)",
      placeholder: "ex: Marche rapide, Squat barre, etc.",
    },
    submit: "Enregistrer",
  },

  week: {
    title: "Pas — semaine en cours",
    rangePrefix: "Du",
    rangeTo: "au",
    totalLabel: "Total",
    stepsUnit: "pas",
    avgPerDayLabel: "Moyenne / jour",
    stepsPerDayUnit: "pas/jour",
    noData: "Aucune donnée saisie pour cette semaine. Ajoutez une entrée ci-dessus pour voir vos stats.",
  },

  latest: {
    title: "Dernières valeurs",
    steps: {
      title: "Pas",
      unit: "pas",
    },
    load: {
      title: "Charges",
    },
    weight: {
      title: "Poids",
    },
    noData: "Aucune donnée.",
  },

  recent: {
    title: "Entrées récentes",
    empty: "Pas encore de données — commencez en ajoutant une entrée ci-dessus.",
    type: {
      steps: "Pas",
      load: "Charges",
      weight: "Poids",
    },
    delete: "Supprimer",
  },
},detail: {
  notFound: {
    title: "Recette introuvable",
    description: "Ouvrez la fiche depuis la liste des recettes.",
    back: "← Retour aux recettes",
  },
  ingredients: {
    title: "Ingrédients",
    empty: "Pas d’ingrédients détaillés.",
  },
  steps: {
    title: "Préparation",
    empty: "Pas d’étapes détaillées.",
  },
  rework: {
    title: "Re-travailler les aliments non aimés",
    description: "On garde le produit et on propose d’autres façons de le cuisiner :",
  },
  back: "← Retour",
},profile: {
  title: "Mon profil",

  messages: {
    programmeUpdated: "✓ Programme IA mis à jour à partir de vos dernières réponses au questionnaire.",
    successGeneric: "✓ Opération réussie.",
  },

  infoSection: {
    title: "Mes infos",
  },

  info: {
    firstName: {
      label: "Prénom",
      missing: "Non renseigné",
    },
    age: {
      label: "Âge",
      missing: "Non renseigné",
    },
    goal: {
      label: "Objectif actuel",
      missing: "Non défini",
    },
    mail: {
      label: "Mail",
      missing: "Non renseigné",
    },
    questionnaire: {
      updateLink: "Mettre à jour mes réponses au questionnaire",
    },
  },

  goal: {
    labels: {
      hypertrophy: "Hypertrophie / Esthétique",
      fatloss: "Perte de gras",
      strength: "Force",
      endurance: "Endurance / Cardio",
      mobility: "Mobilité / Souplesse",
      general: "Forme générale",
    },
  },

  sessions: {
    title: "Mes séances",
    titleNoEquip: "Mes séances (sans matériel)",
    toggle: {
      withEquip: "Matériel",
      withoutEquip: "Sans matériel",
      withEquipTitle: "Voir la liste avec matériel",
      withoutEquipTitle: "Voir la liste sans matériel",
    },
    generateCard: {
      text: "Cliquez sur « Générer » pour afficher vos séances personnalisées.",
      button: "Générer",
      buttonTitle: "Générer mes séances",
    },
  },

  lists: {
    title: "Mes listes",
    done: {
      title: "Séance faite",
    },
    later: {
      title: "À faire plus tard",
    },
    removeLabel: "Supprimer cette séance",
  },
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
      seancePage: {
  fallbackTitle: "Personalized session",
  focus: {
    upper: "Upper body",
    lower: "Lower body",
    full: "Full body",
    mix: "Mix",
  },
  backButton: "← Back",
  aiBadge: "AI program",
  plannedMinSuffix: "min",
  chips: {
    setsLabel: "Sets",
    repsLabel: "Reps/Duration",
    restLabel: "Rest",
  },
  errors: {
    notFound: "Session not found",
  },
},recipes: {
  pageTitle: "Recipes",
  pageSubtitle: "Healthy base for everyone + personalised AI suggestions based on your filters.",

  filters: {
    activeLabel: "Active filters —",
    target: "target",
    range: "range",
    kcalSuffix: "kcal",
    allergens: "allergens",
    dislikes: "disliked",
    none: "none",
  },

  quickSwitch: {
    meals: {
      title: "Recipes — Healthy meals",
      subtitle: "Healthy plates & bowls",
    },
    shakes: {
      title: "Protein bar — Drinks",
      subtitle: "Shakes/smoothies in 5 minutes",
    },
    activeBadge: "Active",
  },

  constraints: {
    title: "Constraints & filters (for AI)",
    kcalTargetLabel: "Calorie target (kcal)",
    kcalMinLabel: "Min kcal",
    kcalMaxLabel: "Max kcal",
    allergensLabel: "Allergies / intolerances (comma-separated)",
    allergensPlaceholder: "peanut, lactose, gluten",
    dislikesLabel: "Foods you don’t like (to rework)",
    dislikesPlaceholder: "broccoli, salmon, tofu...",
    dislikesHelp: "AI keeps them but suggests another way to cook them.",
    footerNote: "Filters mainly apply to personalised AI suggestions.",
    resetButton: "Reset",
    regenerateButton: "Regenerate",
  },

  saved: {
    title: "Your saved recipes",
    removeButton: "Remove",
  },

  mealsSection: {
    title: "Recipes",
    subtitle: "Fixed, stable and tested recipes.",
  },

  shakesSection: {
    title: "Protein drinks — base",
    subtitle: "Quick shakes & smoothies.",
  },

  card: {
    viewRecipe: "View recipe",
    savedRemove: "Saved ✓ (Remove)",
    save: "Save",
  },
},aiSection: {
  title: "Personalised AI suggestions",
  subtitle: "Generated live with AI based on your filters.",
  unavailable: "AI unavailable at the moment.",
  loading: "Generating…",
  badge: "AI personalised",
},progress: {
  pageTitle: "My progress",
  pageSubtitle: "Add your steps, loads and bodyweight. Your data stays local (cookie).",

  messages: {
    saved: "✓ Entry saved.",
    deleted: "Entry deleted.",
    errorPrefix: "⚠️ Error:",
  },

  form: {
    title: "Add an entry",
    type: {
      label: "Type",
      steps: "Steps",
      load: "Lifts (kg)",
      weight: "Bodyweight (kg)",
      help: "For lifts, you can also fill the reps field below.",
    },
    date: {
      label: "Date",
    },
    value: {
      label: "Value",
      placeholder: "e.g. 8000 (steps) / 60 (kg)",
    },
    reps: {
      label: "Reps (optional, lifts)",
      placeholder: "e.g. 8",
    },
    note: {
      label: "Note (optional)",
      placeholder: "e.g. Fast walk, barbell squat, etc.",
    },
    submit: "Save",
  },

  week: {
    title: "Steps — current week",
    rangePrefix: "From",
    rangeTo: "to",
    totalLabel: "Total",
    stepsUnit: "steps",
    avgPerDayLabel: "Average / day",
    stepsPerDayUnit: "steps/day",
    noData: "No data for this week yet. Add an entry above to see your stats.",
  },

  latest: {
    title: "Latest values",
    steps: {
      title: "Steps",
      unit: "steps",
    },
    load: {
      title: "Lifts",
    },
    weight: {
      title: "Weight",
    },
    noData: "No data.",
  },

  recent: {
    title: "Recent entries",
    empty: "No data yet — start by adding an entry above.",
    type: {
      steps: "Steps",
      load: "Lifts",
      weight: "Weight",
    },
    delete: "Delete",
  },
},
detail: {
  notFound: {
    title: "Recipe not found",
    description: "Open this recipe from the recipes list.",
    back: "← Back to recipes",
  },
  ingredients: {
    title: "Ingredients",
    empty: "No detailed ingredients.",
  },
  steps: {
    title: "Preparation",
    empty: "No detailed steps.",
  },
  rework: {
    title: "Reworking disliked foods",
    description: "We keep the ingredient and suggest other ways to cook it:",
  },
  back: "← Back",
},profile: {
  title: "My profile",

  messages: {
    programmeUpdated: "✓ AI program updated from your latest questionnaire answers.",
    successGeneric: "✓ Operation completed.",
  },

  infoSection: {
    title: "My info",
  },

  info: {
    firstName: {
      label: "First name",
      missing: "Not provided",
    },
    age: {
      label: "Age",
      missing: "Not provided",
    },
    goal: {
      label: "Current goal",
      missing: "Not set",
    },
    mail: {
      label: "Email",
      missing: "Not provided",
    },
    questionnaire: {
      updateLink: "Update my questionnaire answers",
    },
  },

  goal: {
    labels: {
      hypertrophy: "Hypertrophy / Aesthetics",
      fatloss: "Fat loss",
      strength: "Strength",
      endurance: "Endurance / Cardio",
      mobility: "Mobility / Flexibility",
      general: "General fitness",
    },
  },

  sessions: {
    title: "My sessions",
    titleNoEquip: "My sessions (no equipment)",
    toggle: {
      withEquip: "Equipment",
      withoutEquip: "No equipment",
      withEquipTitle: "Show list with equipment",
      withoutEquipTitle: "Show list without equipment",
    },
    generateCard: {
      text: "Click on “Generate” to display your personalised sessions.",
      button: "Generate",
      buttonTitle: "Generate my sessions",
    },
  },

  lists: {
    title: "My lists",
    done: {
      title: "Session done",
    },
    later: {
      title: "To do later",
    },
    removeLabel: "Remove this session",
  },
},






    },
  },
} as const;
