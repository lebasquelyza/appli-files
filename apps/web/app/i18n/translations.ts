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

    // 🔹 Commun FR
    common: {
      password: {
        show: "Afficher le mot de passe",
        hide: "Masquer le mot de passe",
      },
      loading: "Chargement…",
      error: {
        title: "Oups",
        unknown: "Erreur inconnue",
        reload: "Recharger",
      },
    },

    /* ==================== SETTINGS ==================== */
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
          detailUnavailable:
            "Détail indisponible — regénère ton programme depuis le profil.",
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
      },

      recipes: {
        pageTitle: "Recettes",
        pageSubtitle:
          "Base healthy pour tous + suggestions perso IA selon tes filtres.",
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
          allergensLabel:
            "Allergènes / intolérances (séparés par virgules)",
          allergensPlaceholder: "arachide, lactose, gluten",
          dislikesLabel: "Aliments non aimés (re-travailler)",
          dislikesPlaceholder: "brocoli, saumon, tofu...",
          dislikesHelp:
            "L'IA les garde, mais propose une autre façon de les cuisiner.",
          footerNote:
            "Les filtres s'appliquent surtout aux suggestions perso IA.",
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
      },

      aiSection: {
        title: "Suggestions perso IA",
        subtitle: "Générées en direct avec l'IA selon tes filtres.",
        unavailable: "IA indisponible pour le moment.",
        loading: "Génération en cours…",
        badge: "perso IA",
      },

      profile: {
        title: "Mon profil",
        messages: {
          programmeUpdated:
            "✓ Programme IA mis à jour à partir de vos dernières réponses au questionnaire.",
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
            updateLink:
              "Mettre à jour mes réponses au questionnaire",
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
            text:
              "Cliquez sur « Générer » pour afficher vos séances personnalisées.",
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
        generate: {
          title: "Mes séances",
          button: {
            title:
              "Générer ou mettre à jour le programme",
            generate: "⚙️ Générer",
            generating: "⏳ Génération…",
          },
          loadingMessage:
            "Création de tes séances en cours…",
          error: {
            generic: "Erreur de génération du programme.",
            unknown: "Erreur inconnue",
          },
          defaultTitle: "Séance",
          badge: {
            saved: "Enregistrée",
            later: "Plus tard",
          },
          menu: {
            buttonLabel: "Enregistrer",
            buttonTitle:
              "Enregistrer cette séance",
            title: "Choisir une action",
            done: "Fait",
            doneTitle:
              "Ajouter à « Séances enregistrées »",
            later: "À faire plus tard",
            laterTitle:
              "Ajouter à « À faire plus tard »",
          },
          empty: "Aucune séance disponible pour le moment.",
        },
      },
    },

    /* ==================== MUSIC ==================== */
    music: {
      pageTitle: "Musique",
      pageSubtitle:
        "Minuteur simple + Tabata + lecteur Spotify + titres likés.",
      loading: {
        subtitle: "Chargement…",
      },
      simpleTimer: {
        title: "Minuteur simple",
        minutesLabel: "Minutes",
        secondsLabel: "Secondes",
        start: "Démarrer",
        pause: "Pause",
        resume: "Reprendre",
        reset: "Réinitialiser",
      },
      tabata: {
        cardTitle: "Timer",
        jumpToTabata: "Tabata",
        roundsLabel: "Rounds",
        workSecondsLabel: "Travail (s)",
        restSecondsLabel: "Repos (s)",
        presetTabata: "Tabata 8× 20/10",
        preset4515: "10× 45/15",
        preset3030: "6× 30/30",
        stateWork: "Travail",
        stateRest: "Repos",
        stateDone: "Terminé",
        stateIdle: "Prêt",
        start: "Démarrer",
        pause: "Pause",
        resume: "Reprendre",
        reset: "Réinitialiser",
      },
      spotifyAuth: {
        connectButton: "Se connecter à Spotify",
        disconnectButton: "⏻ Se déconnecter",
        disconnectTitle: "Se déconnecter",
        connectGeneric: "Se connecter",
      },
      spotifyPlayer: {
        title: "Lecteur Spotify",
        connectedDescription:
          "Contrôle du lecteur connecté à ton compte.",
        disconnectedDescription:
          "Connecte-toi pour utiliser le lecteur Spotify.",
        connectButton: "Se connecter",
      },
      spotifyLibrary: {
        connectHint:
          "Connecte-toi à Spotify pour voir tes titres likés et rechercher une musique.",
        errors: {
          likedFetch:
            "Impossible de récupérer les titres likés",
          playerNotReady:
            "Player Spotify non prêt. Lance le lecteur d’abord.",
          playFailed: "Impossible de lancer la lecture",
          searchFailed: "Erreur de recherche",
        },
        liked: {
          title: "Titres likés",
          loading: "Chargement…",
          empty: "Aucun titre liké trouvé.",
        },
        search: {
          title: "Rechercher une musique",
          placeholder: "Nom du titre, artiste…",
          submit: "Rechercher",
          loading: "Recherche en cours…",
        },
        playButton: "Lire",
      },
    },

    /* ==================== MOTIVATION ==================== */
    motivation: {
      pageTitle: "Motivation",
      pageSubtitle:
        "Messages d’encouragement issus de tes fichiers de coaching (mock pour l’instant) + paramètres de réception.",
      loading: {
        subtitle: "Chargement…",
      },
      header: {
        connectedAs: "Connecté en tant que",
        clientFallback: "client",
      },
      preferences: {
        title: "Préférences de notification",
        subtitle:
          "Choisis les jours et l’heure à laquelle tu souhaites recevoir tes messages de motivation.",
        timeLabel: "Heure préférée :",
        timeNote:
          "(Ces réglages sont pour l’instant stockés uniquement ici, côté client.)",
      },
      dayLabels: {
        mon: "Lundi",
        tue: "Mardi",
        wed: "Mercredi",
        thu: "Jeudi",
        fri: "Vendredi",
        sat: "Samedi",
        sun: "Dimanche",
      },
      bar: {
        unreadSuffix: "notification(s) non lue(s).",
        youChose: "Tu as choisi :",
        noDays: "aucun jour",
        at: "à",
        filterAll: "Tout",
        filterUnread: "Non lues",
        markAllRead: "Tout marquer comme lu",
        sending: "Envoi...",
        sendTest: "Envoyer une notif de test",
      },
      empty: {
        title: "Aucune notification à afficher pour le moment.",
        hint:
          'Utilise le bouton “Envoyer une notif de test” pour tester l’affichage.',
      },
      card: {
        badgeNew: "Nouveau",
        sourcePrefix: "Source :",
        ratingLabel: "Ta note :",
        markRead: "Marquer comme lu",
      },
      mock: {
        source: "Files Coaching",
        sourceTest: "Files Coaching (test)",
        first: {
          title: "Tu progresses 💪",
          message:
            "Super séance hier ! Continue sur cette lancée, la régularité fait toute la différence.",
        },
        second: {
          title: "Rappel douceur",
          message:
            "Même une petite séance vaut mieux que rien. 10 minutes aujourd’hui, c’est déjà gagné.",
        },
      },
      samples: {
        onLacheRien: {
          title: "On lâche rien 🔥",
          message:
            "Tu es plus proche de ton objectif aujourd’hui qu’hier. Une action de plus, même petite.",
        },
        respireEtAvance: {
          title: "Respire & avance",
          message:
            "Ne cherche pas la perfection. Cherche la progression. Un pas après l’autre.",
        },
        tuPeuxLeFaire: {
          title: "Tu peux le faire ✨",
          message:
            "Rappelle-toi pourquoi tu as commencé. Tu as déjà traversé plus dur que ça.",
        },
        tonFuturToi: {
          title: "Ton futur toi te remercie",
          message:
            "Chaque décision d’aujourd’hui construit la personne que tu seras dans 3 mois.",
        },
        miniSeance: {
          title: "Mini séance, maxi impact",
          message:
            "Si tu n’as pas le temps pour 30 minutes, fais-en 5. Ce qui compte, c’est le mouvement.",
        },
        recommence: {
          title: "Recommence autant que nécessaire",
          message:
            "Tomber fait partie du jeu. Ce qui compte, c’est à quelle vitesse tu te relèves.",
        },
        tuNESPasSeul: {
          title: "Tu n’es pas seul·e",
          message:
            "Demander de l’aide, c’est aussi une forme de force. Tu fais ça pour TOI.",
        },
        cestTonMoment: {
          title: "C’est ton момент",
          message:
            "Bloque 10 minutes rien que pour toi maintenant. Ton corps et ta tête te diront merci.",
        },
      },
    },

    /* ==================== VIDEO COACH ==================== */
    videoCoach: {
      page: {
        title: "Import / Enregistrement",
        subtitle:
          "Filme ou importe ta vidéo, ajoute ton ressenti puis lance l’analyse IA.",
      },
      status: {
        done: "Analyse terminée — confirme l’exercice",
      },
      error: {
        prefix: "Erreur pendant l'analyse",
        label: "Erreur",
      },
      common: {
        reset: "Réinitialiser",
        unknown: "inconnu",
      },
      card: {
        import: {
          title: "🎥 Import / Enregistrement",
          tabRecord: "Filmer",
          tabUpload: "Importer",
          fileLabel: "Fichier téléchargé",
          fileName: "🎞️ Vidéo importée",
        },
        feeling: {
          title: "🎙️ Ton ressenti",
          label: "Comment tu te sens ?",
          placeholder:
            "Explique douleurs, fatigue, où tu as senti l'effort, RPE, etc.",
          btnAnalyzing: "Analyse en cours",
          btnCooldown: "Patiente ",
          btnLaunch: "Lancer l'analyse IA",
        },
        summary: {
          title: "🧠 Résumé IA",
          empty:
            "Importe une vidéo puis lance l’analyse pour obtenir le résumé ici.",
          gate: {
            propose: "L’IA propose",
            confirm: "Confirmer",
            other: "Autre",
          },
          override: {
            label: "Quel exercice fais-tu ?",
            placeholder:
              "ex. Tractions, Fentes bulgares, Soulevé de terre…",
            reanalyze: "Ré-analyser",
            help:
              "L’IA tiendra compte de ce nom pour corriger plus précisément.",
          },
          exerciseLabel: "Exercice",
          musclesTitle: "Muscles principalement sollicités",
          muscleBtnTitle: "Voir l’emplacement",
          musclesEmpty: "— non détecté —",
          issuesLabel: "Erreur détectée",
          correctionsLabel: "Corrections",
          extrasSummary: "Points complémentaires",
        },
      },
      upload: {
        import: "📥 Importer",
        gallery: "📸 Galerie",
        files: "🗂️ Fichiers",
      },
      videoRecorder: {
        error: {
          camera:
            "Impossible d'accéder à la caméra/micro. Vérifie les permissions.",
        },
        overlay:
          "Prépare ta caméra puis clique « Démarrer »",
        start: "▶️ Démarrer",
        stop: "⏸️ Arrêter",
      },
      muscleViewer: {
        close: "Fermer",
        subtitle:
          "Silhouette simplifiée — aucune zone cliquable, seules les zones sélectionnées sont mises en surbrillance.",
      },
    },

    /* ==================== CONNECT ==================== */
    connect: {
      page: {
        title: "Connecte tes données",
        subtitle:
          "Santé, capteurs, etc. — synchronise automatiquement tes activités et mesures.",
      },
      sections: {
        integrations: "Intégrations",
        stravaTitle: "Dernières performances (Strava)",
        appleTitle: "Dernières performances (Apple Santé)",
        alertTitle: "Recevoir une alerte",
      },
      alerts: {
        connected: "✓ {{name}} connecté.",
        disconnected: "{{name}} déconnecté.",
        subscribed:
          "✓ Nous te préviendrons dès qu’une intégration sera disponible.",
        unsubscribed: "Prévenez-moi désactivé.",
        errorPrefix: "⚠️ Erreur :",
      },
      statusBadge: {
        connected: "Connecté",
        available: "Disponible",
        comingSoon: "À venir",
      },
      integrations: {
        strava: {
          name: "Strava",
          subtitle: "Course, vélo, activités",
          descConnected:
            "Compte relié{{suffix}}. Les activités récentes pourront être importées.",
          descDisconnected:
            "Connexion sécurisée via OAuth pour lire tes activités.",
        },
        appleHealth: {
          name: "Apple Santé",
          subtitle: "iPhone / Apple Watch",
          desc: "Importe ton export.zip pour afficher tes activités (pas d’OAuth Apple sur le Web).",
          smallNote: "(Import depuis Profil)",
        },
        googleFit: {
          name: "Google Fit",
          subtitle: "Android / WearOS",
          descConnected:
            "Compte Google Fit relié. Les sessions récentes peuvent être lues (lecture seule).",
          descDisconnected:
            "Connexion sécurisée via OAuth pour lire tes sessions Google Fit.",
        },
        generic: {
          garmin: {
            name: "Garmin",
            subtitle: "Montres GPS",
          },
          fitbit: {
            name: "Fitbit",
            subtitle: "Capteurs & sommeil",
          },
          withings: {
            name: "Withings",
            subtitle: "Balances & santé",
          },
          descComingSoon:
            "Bientôt : connexion sécurisée via OAuth. Tes données restent sous ton contrôle.",
        },
      },
      buttons: {
        connect: "Connecter",
        disconnect: "Déconnecter",
        learnMore: "En savoir plus",
        comingSoonTitle: "Bientôt disponible",
        disable: "Désactiver",
        notifyMe: "Me prévenir",
      },
      strava: {
        empty:
          "Aucune activité récente trouvée (ou accès non autorisé).",
        elevationSuffix: "m D+",
      },
      apple: {
        empty: "Aucune activité trouvée dans l’export.",
        badgeSource: "Apple",
        kcalSuffix: "kcal",
      },
      alert: {
        title:
          "Préviens-moi quand les intégrations arrivent",
        subtitle:
          "Notification dans l’app (préférence stockée en local).",
      },
    },

    /* ==================== CALORIES + FOOD SNAP ==================== */
    calories: {
      page: {
        title: "Calories",
        subtitle:
          "Enregistre tes calories consommées aujourd’hui. Historique sur 14 jours.",
      },
      alert: {
        saved: {
          title: "Enregistré !",
          text: "Tes calories ont été mises à jour.",
        },
        error: {
          title: "Erreur",
          badDate: "date invalide.",
          badKcal: "valeur de calories invalide.",
        },
      },
      today: {
        title: "Aujourd’hui",
        unit: "kcal",
      },
      form: {
        kcal: {
          label: "Calories à ajouter",
          placeholder: "ex: 650",
          helper:
            "La valeur s’ajoute au total du jour (elle n’écrase pas).",
        },
        note: {
          label: "Note (optionnel)",
          placeholder: "ex: Déj: poke bowl",
        },
        buttons: {
          save: "Enregistrer",
          refresh: "Actualiser",
        },
      },
      history: {
        title: "Historique (14 jours)",
        toggle: "(cliquer pour afficher/masquer)",
        helper:
          "Les jours sans saisie sont à 0 kcal.",
        headers: {
          date: "Date",
          kcal: "kcal",
          note: "Note",
        },
      },

      foodSnap: {
        errors: {
          analyzeGeneric: "Analyse impossible",
          unknown: "Erreur inconnue",
          offNoProduct:
            "OpenFoodFacts indisponible ou aucun produit. Saisis manuellement ou utilise la photo.",
          offUnavailable:
            "OFF non joignable. Essaie plus tard ou saisis manuellement.",
        },
        header: {
          title:
            'Ajouter depuis une <u>photo</u>, un <u>code-barres</u> ou une <u>recherche</u>',
          subtitle:
            "OFF/USDA prioritaire (valeurs réelles), sinon IA/manuel.",
        },
        buttons: {
          photo: "📸 Photo",
          scan: "🧾 Scanner",
        },
        search: {
          title: "Recherche manuelle (OFF + USDA)",
          placeholder:
            'ex: "riz basmati", "banane", "blanc de poulet", "yaourt grec 0%"',
          loading: "Recherche…",
          submit: "Rechercher",
          noResult:
            "Aucun résultat. Saisis manuellement kcal/100g ou essaie un autre terme.",
          error:
            "Recherche indisponible. Essaie plus tard ou saisis manuellement.",
          proteinsShort: "prot",
          sourceLabel: "Source",
          choose: "Choisir",
        },
        preview: {
          alt: "prévisualisation",
          analyzeLoading: "Analyse…",
          analyze: "Analyser la photo",
          reset: "Réinitialiser",
        },
        plate: {
          title: "Décomposition de l’assiette (éditable)",
          grams: "Grammes",
          kcalPer100: "kcal/100g",
          protPer100: "Prot/100g",
          proteinsShort: "g prot",
          total: "Total",
          totalProteinsShort: "g protéines",
        },
        product: {
          title: "Produit",
          sourceLabel: "Source",
          portion: "Portion (g)",
          kcalPer100: "kcal / 100 g",
          protPer100: "Prot / 100 g",
          total: "Total",
          totalProteinsShort: "g protéines",
        },
        help: {
          manual:
            "⚡ Si aucune base ne répond, tu peux saisir les valeurs manuellement (kcal/prot pour 100 g), puis indiquer la portion.",
        },
        actions: {
          fillForm: "Remplir le formulaire en haut",
          addToCalories: "Ajouter à mes calories",
        },
      },
    },

    barcodeScanner: {
      cameraError: "Caméra indisponible ou permissions refusées.",
      title: "Scanner un code-barres",
      close: "Fermer",
      notSupported:
        "Le scanner natif n’est pas supporté sur cet appareil/navigateur. Saisis le code-barres manuellement ou prends une photo de l’étiquette.",
      manualPlaceholder: "Saisir le code-barres (ex: 3228857000856)",
      invalid: "Code-barres invalide (8 à 14 chiffres).",
      useButton: "Utiliser",
      tip: "Astuce : approche bien le code et évite les reflets.",
    },

    /* ==================== BMI ==================== */
    bmi: {
      page: {
        title: "IMC",
        subtitle: "Calcule ton indice de masse corporelle",
      },
      section: {
        title: "Calculatrice",
      },
      fields: {
        heightLabel: "Taille (cm)",
        weightLabel: "Poids (kg)",
      },
      result: {
        normalRange: "18.5–24.9 = normal",
      },
      note: "N’oublie pas : l’IMC et le poids ne sont que des chiffres ;)",
    },

    /* ==================== AVIS ==================== */
    avis: {
      page: {
        title: "Votre avis",
        subtitle:
          "Dis-nous ce que tu penses de l’app pour qu’on puisse l’améliorer 🙌",
      },
      status: {
        sent:
          "Merci pour ton avis 🙏 On lit tous les messages avec attention.",
        errors: {
          empty:
            "Oups 😅 Merci d'écrire un petit message avant d'envoyer.",
          server:
            "Une erreur est survenue côté serveur (configuration e-mail). Réessaie plus tard.",
          send:
            "Impossible d'envoyer ton avis pour le moment 😕 Réessaie un peu plus tard.",
        },
      },
      form: {
        emailLabel: "Ton e-mail (si tu veux qu'on te réponde)",
        emailPlaceholder: "ton.email@exemple.com",
        messageLabel: "Ton message",
        messagePlaceholder:
          "Dis-nous ce qui te plaît, ce qu’on peut améliorer, des idées de fonctionnalités...",
        submit: "Envoyer mon avis",
      },
    },

    /* ==================== ABONNEMENT ==================== */
    abonnement: {
      page: {
        title: "Abonnements",
        headerTitle: "Abonnement & Tarifs",
        headerDescription:
          "Choisissez la formule qui vous convient et activez Coaching+ si besoin.\nLes changements s’appliquent immédiatement dans l’app (démo : sans paiement réel).",
        currentPlanLabel: "Plan actuel",
      },
      alerts: {
        success: "✅ Mise à jour enregistrée.",
        errorPrefix: "⚠️ Erreur :",
      },
      current: {
        sectionTitle: "Votre abonnement",
        activeBadge: "Plan actif",
        nextPayment: "Prochain prélèvement :",
        expiresAt: "Expiration :",
        coachingOption: "Option Coaching+ :",
        monthlyTotal: "Total mensuel :",
      },
      explainer: {
        title: "Ce que vous obtenez",
        items: {
          basic:
            "Basic : Recettes healthy + minuteur d’exercices.",
          plus:
            "Plus : IA recettes personnalisées (calories, allergènes), historique & favoris.",
          premium:
            "Premium : Plans hebdo IA + correction vidéo + support prioritaire.",
          coaching:
            "Coaching+ : Visio/séances réelles en supplément au mois.",
        },
      },
      plans: {
        sectionTitle: "Formules",
        badges: {
          recommended: "Recommandé",
          active: "Actif",
        },
        coachingOptionLabel: "Option Coaching+",
        totalIndicative: "Total indicatif :",
        buttons: {
          update: "Mettre à jour",
          chooseBasic: "Choisir Basic",
          choosePlus: "Choisir Plus",
          choosePremium: "Choisir Premium",
        },
      },
      cards: {
        BASIC: {
          title: "Basic",
          tagline: "Recettes + Minuteur",
          features: [
            "Recettes générales",
            "Minuteur d’exercices",
            "Support par email",
          ],
        },
        PLUS: {
          title: "Plus",
          tagline: "Basic + Personnalisation",
          features: [
            "Recettes personnalisées (IA)",
            "Filtres avancés (allergènes, régimes)",
            "Historique & favoris",
          ],
        },
        PREMIUM: {
          title: "Premium",
          tagline: "Plus + IA correction",
          features: [
            "Plans repas hebdo IA",
            "Correction vidéo des exercices",
            "Priorité support",
          ],
        },
      },
      coachingPlusOptions: {
        none: "Sans option Coaching+",
        visio1: "1 visio/mois avec coach (+20 €)",
        real1: "1 séance réelle/mois (+40 €)",
        real4: "Pack 4 séances réelles/mois (+140 €)",
        real8: "Pack 8 séances réelles/mois (+240 €)",
      },
    },

    abonnementSuccess: {
      noSession: {
        title: "Paiement",
        text: "Session Stripe introuvable.",
        back: "Retour",
      },
      pending: {
        title: "Paiement en cours",
        text: "Le paiement n’est pas encore confirmé. Réessayez dans quelques instants.",
        back: "Retour",
      },
      done: {
        title: "Abonnement activé",
        text: "Merci ! Votre accès premium est maintenant actif.",
        totalLabel: "Total mensuel : {{amount}} €",
        back: "Retour à l’abonnement",
      },
    },

    /* ==================== PROGRESS ==================== */
    progress: {
      pageTitle: "Mes progrès",
      pageSubtitle:
        "Ajoutez vos pas, vos charges et votre poids. Vos données restent en local (cookie).",
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
          help:
            "Pour charges, vous pouvez renseigner les répétitions ci-dessous.",
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
        noData:
          "Aucune donnée saisie pour cette semaine. Ajoutez une entrée ci-dessus pour voir vos stats.",
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
        empty:
          "Pas encore de données — commencez en ajoutant une entrée ci-dessus.",
        type: {
          steps: "Pas",
          load: "Charges",
          weight: "Poids",
        },
        delete: "Supprimer",
      },
    },

    /* ==================== RECIPES PAGE ==================== */
    recipes: {
      pageTitle: "Recettes",
      pageSubtitle:
        "Base healthy pour tous + suggestions perso IA selon tes filtres.",
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
        allergensLabel:
          "Allergènes / intolérances (séparés par virgules)",
        allergensPlaceholder: "arachide, lactose, gluten",
        dislikesLabel: "Aliments non aimés (re-travailler)",
        dislikesPlaceholder: "brocoli, saumon, tofu...",
        dislikesHelp:
          "L'IA les garde, mais propose une autre façon de les cuisiner.",
        footerNote:
          "Les filtres s'appliquent surtout aux suggestions perso IA.",
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
      aiSection: {
        title: "Suggestions perso IA",
        subtitle:
          "Générées en direct avec l'IA selon tes filtres.",
        unavailable: "IA indisponible pour le moment.",
        loading: "Génération en cours…",
        badge: "perso IA",
      },
      detail: {
        notFound: {
          title: "Recette introuvable",
          description:
            "Ouvrez la fiche depuis la liste des recettes.",
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
          description:
            "On garde le produit et on propose d’autres façons de le cuisiner :",
        },
        back: "← Retour",
      },
    },

    /* ==================== DASHBOARD ==================== */
    dashboard: {
      header: {
        title: "Bienvenue 👋",
        subtitle:
          "Aperçu rapide de ta progression et des données du jour.",
      },
      kpi: {
        calories: "Calories aujourd'hui",
        steps: "Steps du jour",
        lastSession: "Dernière séance",
        manage: "Gérer",
      },
      quick: {
        calories: {
          title: "Calories",
          text:
            "Consulte ton historique ou ajoute ta consommation d’aujourd’hui.",
          button: "Gérer mes calories →",
        },
        workouts: {
          title: "Entraînements",
          text:
            "Crée, démarre ou consulte tes séances d’entraînement passées.",
          button: "Voir mes séances →",
        },
      },
    },
  },

  /* ================================================================= */
  /* =============================== EN =============================== */
  /* ================================================================= */

  en: {
    home: {
      hero: {
        titleLine1: "Files Coaching —",
        titleLine2: "AI Fitness Coach",
        subtitle:
          "Personalized workouts, guidance and tracking",
        bullets: {
          program:
            "✅ Personalized program tailored to your goals",
          timerMusic:
            "✅ Built-in timer & music for your sessions",
          recipes:
            "✅ Healthy recipes & nutrition advice",
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
          invalidEmail:
            "Invalid or already used email.",
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
      loading: "Loading…",
      error: {
        title: "Oops",
        unknown: "Unknown error",
        reload: "Reload",
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
        questionLabel:
          "Why are you leaving? (optional)",
        reasons: {
          no_longer_needed:
            "I don’t need it anymore",
          missing_features:
            "Missing features",
          too_expensive:
            "Too expensive / not worth it",
          privacy_concerns:
            "Data & privacy concerns",
          bugs_or_quality:
            "Bugs / unsatisfying quality",
          other: "Other…",
        },
        otherPlaceholder:
          "Tell us more (optional)",
        irreversibleText:
          "This action is irreversible: your data and access will be deleted. To confirm, type",
        confirmPlaceholder: "DELETE",
        alerts: {
          needRelogin:
            "Please log in again before deleting your account.",
          success:
            "Your account has been deleted. Goodbye 👋",
          errorGeneric:
            "Unable to delete the account",
          errorDuringDelete:
            "Error while deleting the account",
        },
        button: {
          loading: "Deleting…",
          idle: "Delete permanently",
        },
        confirmFieldAria:
          "Account deletion confirmation field",
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
        modalAriaLabel:
          "Legal notice and cookie policy",
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
          detailUnavailable:
            "Details unavailable — regenerate your program from the profile page.",
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
      },

      recipes: {
        pageTitle: "Recipes",
        pageSubtitle:
          "Healthy base for everyone + personalised AI suggestions based on your filters.",
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
          allergensLabel:
            "Allergies / intolerances (comma-separated)",
          allergensPlaceholder:
            "peanut, lactose, gluten",
          dislikesLabel:
            "Foods you don’t like (to rework)",
          dislikesPlaceholder:
            "broccoli, salmon, tofu...",
          dislikesHelp:
            "AI keeps them but suggests another way to cook them.",
          footerNote:
            "Filters mainly apply to personalised AI suggestions.",
          resetButton: "Reset",
          regenerateButton: "Regenerate",
        },
        saved: {
          title: "Your saved recipes",
          removeButton: "Remove",
        },
        mealsSection: {
          title: "Recipes",
          subtitle:
            "Fixed, stable and tested recipes.",
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
      },

      aiSection: {
        title: "Personalised AI suggestions",
        subtitle:
          "Generated live with AI based on your filters.",
        unavailable: "AI unavailable at the moment.",
        loading: "Generating…",
        badge: "AI personalised",
      },

      profile: {
        title: "My profile",
        messages: {
          programmeUpdated:
            "✓ AI program updated from your latest questionnaire answers.",
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
            updateLink:
              "Update my questionnaire answers",
          },
        },
        goal: {
          labels: {
            hypertrophy:
              "Hypertrophy / Aesthetics",
            fatloss: "Fat loss",
            strength: "Strength",
            endurance:
              "Endurance / Cardio",
            mobility:
              "Mobility / Flexibility",
            general: "General fitness",
          },
        },
        sessions: {
          title: "My sessions",
          titleNoEquip:
            "My sessions (no equipment)",
          toggle: {
            withEquip: "Equipment",
            withoutEquip: "No equipment",
            withEquipTitle:
              "Show list with equipment",
            withoutEquipTitle:
              "Show list without equipment",
          },
          generateCard: {
            text:
              "Click on “Generate” to display your personalised sessions.",
            button: "Generate",
            buttonTitle:
              "Generate my sessions",
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
        generate: {
          title: "My Sessions",
          button: {
            title:
              "Generate or update the program",
            generate: "⚙️ Generate",
            generating: "⏳ Generating…",
          },
          loadingMessage: "Creating your sessions…",
          error: {
            generic: "Program generation error.",
            unknown: "Unknown error",
          },
          defaultTitle: "Session",
          badge: {
            saved: "Saved",
            later: "Later",
          },
          menu: {
            buttonLabel: "Save",
            buttonTitle:
              "Save this session",
            title: "Choose an action",
            done: "Done",
            doneTitle:
              "Add to “Completed Sessions”",
            later: "Do later",
            laterTitle:
              "Add to “Do later”",
          },
          empty: "No sessions available for now.",
        },
      },
    },

    music: {
      pageTitle: "Music",
      pageSubtitle:
        "Simple timer + Tabata + Spotify player + liked tracks.",
      loading: {
        subtitle: "Loading...",
      },
      simpleTimer: {
        title: "Simple timer",
        minutesLabel: "Minutes",
        secondsLabel: "Seconds",
        start: "Start",
        pause: "Pause",
        resume: "Resume",
        reset: "Reset",
      },
      tabata: {
        cardTitle: "Timer",
        jumpToTabata: "Tabata",
        roundsLabel: "Rounds",
        workSecondsLabel: "Work (s)",
        restSecondsLabel: "Rest (s)",
        presetTabata: "Tabata 8× 20/10",
        preset4515: "10× 45/15",
        preset3030: "6× 30/30",
        stateWork: "Work",
        stateRest: "Rest",
        stateDone: "Done",
        stateIdle: "Ready",
        start: "Start",
        pause: "Pause",
        resume: "Resume",
        reset: "Reset",
      },
      spotifyAuth: {
        connectButton: "Sign in with Spotify",
        disconnectButton: "⏻ Log out",
        disconnectTitle: "Log out",
        connectGeneric: "Sign in",
      },
      spotifyPlayer: {
        title: "Spotify player",
        connectedDescription:
          "Control the player connected to your account.",
        disconnectedDescription:
          "Sign in to use the Spotify player.",
        connectButton: "Sign in",
      },
      spotifyLibrary: {
        connectHint:
          "Sign in to Spotify to see your liked tracks and search for music.",
        errors: {
          likedFetch: "Unable to fetch liked tracks",
          playerNotReady:
            "Spotify player not ready. Start the player first.",
          playFailed: "Unable to start playback",
          searchFailed: "Search error",
        },
        liked: {
          title: "Liked tracks",
          loading: "Loading...",
          empty: "No liked tracks found.",
        },
        search: {
          title: "Search a track",
          placeholder: "Track name, artist…",
          submit: "Search",
          loading: "Searching…",
        },
        playButton: "Play",
      },
    },

    motivation: {
      pageTitle: "Motivation",
      pageSubtitle:
        "Encouraging messages from your coaching files (mock for now) + delivery settings.",
      loading: {
        subtitle: "Loading...",
      },
      header: {
        connectedAs: "Signed in as",
        clientFallback: "client",
      },
      preferences: {
        title: "Notification preferences",
        subtitle:
          "Choose the days and time when you want to receive your motivation messages.",
        timeLabel: "Preferred time:",
        timeNote:
          "(These settings are currently stored here only, on the client side.)",
      },
      dayLabels: {
        mon: "Monday",
        tue: "Tuesday",
        wed: "Wednesday",
        thu: "Thursday",
        fri: "Friday",
        sat: "Saturday",
        sun: "Sunday",
      },
      bar: {
        unreadSuffix: "unread notification(s).",
        youChose: "You chose:",
        noDays: "no day",
        at: "at",
        filterAll: "All",
        filterUnread: "Unread",
        markAllRead: "Mark all as read",
        sending: "Sending...",
        sendTest: "Send test notification",
      },
      empty: {
        title: "No notifications to display for now.",
        hint:
          'Use the “Send test notification” button to test the display.',
      },
      card: {
        badgeNew: "New",
        sourcePrefix: "Source:",
        ratingLabel: "Your rating:",
        markRead: "Mark as read",
      },
      mock: {
        source: "Files Coaching",
        sourceTest: "Files Coaching (test)",
        first: {
          title: "You’re progressing 💪",
          message:
            "Great session yesterday! Keep going, consistency makes all the difference.",
        },
        second: {
          title: "Gentle reminder",
          message:
            "Even a short session is better than nothing. 10 minutes today is already a win.",
        },
      },
      samples: {
        onLacheRien: {
          title: "Don’t give up 🔥",
          message:
            "You’re closer to your goal today than yesterday. One more action, even a small one.",
        },
        respireEtAvance: {
          title: "Breathe & move forward",
          message:
            "Don’t aim for perfection. Aim for progress. One step at a time.",
        },
        tuPeuxLeFaire: {
          title: "You can do it ✨",
          message:
            "Remember why you started. You’ve already been through tougher things.",
        },
        tonFuturToi: {
          title: "Your future self thanks you",
          message:
            "Every decision you make today shapes who you’ll be in 3 months.",
        },
        miniSeance: {
          title: "Mini session, maxi impact",
          message:
            "If you don’t have 30 minutes, do 5. What matters is moving.",
        },
        recommence: {
          title: "Start again as many times as needed",
          message:
            "Falling is part of the game. What matters is how fast you get back up.",
        },
        tuNESPasSeul: {
          title: "You’re not alone",
          message:
            "Asking for help is also a form of strength. You’re doing this for YOU.",
        },
        cestTonMoment: {
          title: "This is your moment",
          message:
            "Block 10 minutes just for yourself now. Your body and mind will thank you.",
        },
      },
    },

    videoCoach: {
      page: {
        title: "Import / Recording",
        subtitle:
          "Record or import your video, add your feedback, then launch the AI analysis.",
      },
      status: {
        done: "Analysis done — confirm the exercise",
      },
      error: {
        prefix: "Error during analysis",
        label: "Error",
      },
      common: {
        reset: "Reset",
        unknown: "unknown",
      },
      card: {
        import: {
          title: "🎥 Import / Recording",
          tabRecord: "Record",
          tabUpload: "Import",
          fileLabel: "Uploaded file",
          fileName: "🎞️ Video imported",
        },
        feeling: {
          title: "🎙️ Your feedback",
          label: "How do you feel?",
          placeholder:
            "Explain pain, fatigue, where you felt the effort, RPE, etc.",
          btnAnalyzing: "Analyzing…",
          btnCooldown: "Please wait ",
          btnLaunch: "Start AI analysis",
        },
        summary: {
          title: "🧠 AI Summary",
          empty:
            "Import a video and run the analysis to see the summary here.",
          gate: {
            propose: "AI suggests",
            confirm: "Confirm",
            other: "Other",
          },
          override: {
            label: "Which exercise are you doing?",
            placeholder:
              "e.g. Pull-ups, Bulgarian split squats, Deadlift…",
            reanalyze: "Re-analyze",
            help:
              "The AI will use this name to give more precise corrections.",
          },
          exerciseLabel: "Exercise",
          musclesTitle: "Main muscles targeted",
          muscleBtnTitle: "Show location",
          musclesEmpty: "— not detected —",
          issuesLabel: "Detected issue",
          correctionsLabel: "Corrections",
          extrasSummary: "Additional points",
        },
      },
      upload: {
        import: "📥 Import",
        gallery: "📸 Gallery",
        files: "🗂️ Files",
      },
      videoRecorder: {
        error: {
          camera:
            "Unable to access camera/mic. Check your permissions.",
        },
        overlay:
          "Get your camera ready then click “Start”",
        start: "▶️ Start",
        stop: "⏸️ Stop",
      },
      muscleViewer: {
        close: "Close",
        subtitle:
          "Simplified silhouette — no clickable zones, only highlighted areas are shown.",
      },
    },

    connect: {
      page: {
        title: "Connect your data",
        subtitle:
          "Health, trackers, etc. — automatically sync your activities and metrics.",
      },
      sections: {
        integrations: "Integrations",
        stravaTitle: "Latest performances (Strava)",
        appleTitle: "Latest performances (Apple Health)",
        alertTitle: "Get an alert",
      },
      alerts: {
        connected: "✓ {{name}} connected.",
        disconnected: "{{name}} disconnected.",
        subscribed:
          "✓ We’ll notify you as soon as a new integration is available.",
        unsubscribed: "Notifications disabled.",
        errorPrefix: "⚠️ Error:",
      },
      statusBadge: {
        connected: "Connected",
        available: "Available",
        comingSoon: "Coming soon",
      },
      integrations: {
        strava: {
          name: "Strava",
          subtitle: "Running, cycling, activities",
          descConnected:
            "Account linked{{suffix}}. Recent activities can be imported.",
          descDisconnected:
            "Secure OAuth connection to read your activities.",
        },
        appleHealth: {
          name: "Apple Health",
          subtitle: "iPhone / Apple Watch",
          desc: "Import your export.zip to display your activities (no Apple OAuth on the Web).",
          smallNote: "(Import from Profile)",
        },
        googleFit: {
          name: "Google Fit",
          subtitle: "Android / WearOS",
          descConnected:
            "Google Fit account linked. Recent sessions can be read (read-only).",
          descDisconnected:
            "Secure OAuth connection to read your Google Fit sessions.",
        },
        generic: {
          garmin: {
            name: "Garmin",
            subtitle: "GPS watches",
          },
          fitbit: {
            name: "Fitbit",
            subtitle: "Trackers & sleep",
          },
          withings: {
            name: "Withings",
            subtitle: "Scales & health",
          },
          descComingSoon:
            "Coming soon: secure OAuth connection. Your data stays under your control.",
        },
      },
      buttons: {
        connect: "Connect",
        disconnect: "Disconnect",
        learnMore: "Learn more",
        comingSoonTitle: "Coming soon",
        disable: "Disable",
        notifyMe: "Notify me",
      },
      strava: {
        empty:
          "No recent activity found (or access not authorized).",
        elevationSuffix: "m elevation gain",
      },
      apple: {
        empty: "No activity found in the export.",
        badgeSource: "Apple",
        kcalSuffix: "kcal",
      },
      alert: {
        title:
          "Notify me when integrations are available",
        subtitle:
          "In-app notification (preference stored locally).",
      },
    },

    calories: {
      page: {
        title: "Calories",
        subtitle:
          "Log the calories you ate today. 14-day history.",
      },
      alert: {
        saved: {
          title: "Saved!",
          text: "Your calories have been updated.",
        },
        error: {
          title: "Error",
          badDate: "invalid date.",
          badKcal: "invalid calories value.",
        },
      },
      today: {
        title: "Today",
        unit: "kcal",
      },
      form: {
        kcal: {
          label: "Calories to add",
          placeholder: "e.g. 650",
          helper:
            "This value is added to today’s total (it doesn’t overwrite it).",
        },
        note: {
          label: "Note (optional)",
          placeholder: "e.g. Lunch: poke bowl",
        },
        buttons: {
          save: "Save",
          refresh: "Refresh",
        },
      },
      history: {
        title: "History (14 days)",
        toggle: "(click to show/hide)",
        helper:
          "Days without entries are at 0 kcal.",
        headers: {
          date: "Date",
          kcal: "kcal",
          note: "Note",
        },
      },

      foodSnap: {
        errors: {
          analyzeGeneric: "Analysis failed",
          unknown: "Unknown error",
          offNoProduct:
            "OpenFoodFacts unavailable or no product found. Enter values manually or use a photo.",
          offUnavailable:
            "OFF unreachable. Try again later or enter values manually.",
        },
        header: {
          title:
            'Add from a <u>photo</u>, a <u>barcode</u> or a <u>search</u>',
          subtitle:
            "OFF/USDA is used first (real values), otherwise AI/manual.",
        },
        buttons: {
          photo: "📸 Photo",
          scan: "🧾 Scan",
        },
        search: {
          title: "Manual search (OFF + USDA)",
          placeholder:
            'e.g. "basmati rice", "banana", "chicken breast", "greek yogurt 0%"',
          loading: "Searching…",
          submit: "Search",
          noResult:
            "No result. Enter kcal/100g manually or try another term.",
          error:
            "Search unavailable. Try again later or enter values manually.",
          proteinsShort: "prot",
          sourceLabel: "Source",
          choose: "Select",
        },
        preview: {
          alt: "preview",
          analyzeLoading: "Analyzing…",
          analyze: "Analyze photo",
          reset: "Reset",
        },
        plate: {
          title: "Plate breakdown (editable)",
          grams: "Grams",
          kcalPer100: "kcal/100g",
          protPer100: "Protein/100g",
          proteinsShort: "g protein",
          total: "Total",
          totalProteinsShort: "g protein",
        },
        product: {
          title: "Product",
          sourceLabel: "Source",
          portion: "Portion (g)",
          kcalPer100: "kcal / 100 g",
          protPer100: "Protein / 100 g",
          total: "Total",
          totalProteinsShort: "g protein",
        },
        help: {
          manual:
            "⚡ If no database returns a match, you can enter values manually (kcal/protein per 100 g), then set the portion.",
        },
        actions: {
          fillForm: "Fill the form above",
          addToCalories: "Add to my calories",
        },
      },
    },

    barcodeScanner: {
      cameraError: "Camera unavailable or permissions denied.",
      title: "Scan a barcode",
      close: "Close",
      notSupported:
        "The native scanner is not supported on this device/browser. Enter the barcode manually or take a photo of the label.",
      manualPlaceholder:
        "Enter the barcode (e.g. 3228857000856)",
      invalid: "Invalid barcode (8 to 14 digits).",
      useButton: "Use",
      tip: "Tip: hold the barcode close and avoid glare.",
    },

    bmi: {
      page: {
        title: "BMI",
        subtitle: "Calculate your Body Mass Index",
      },
      section: {
        title: "Calculator",
      },
      fields: {
        heightLabel: "Height (cm)",
        weightLabel: "Weight (kg)",
      },
      result: {
        normalRange: "18.5–24.9 = normal",
      },
      note: "Remember: BMI and weight are just numbers ;)",
    },

    avis: {
      page: {
        title: "Your feedback",
        subtitle:
          "Tell us what you think about the app so we can improve it 🙌",
      },
      status: {
        sent:
          "Thank you for your feedback 🙏 We read every message carefully.",
        errors: {
          empty:
            "Oops 😅 Please write a short message before sending.",
          server:
            "A server error occurred (email configuration). Please try again later.",
          send:
            "We couldn’t send your feedback right now 😕 Please try again later.",
        },
      },
      form: {
        emailLabel: "Your email (if you want a reply)",
        emailPlaceholder: "your.email@example.com",
        messageLabel: "Your message",
        messagePlaceholder:
          "Tell us what you like, what we can improve, ideas for features...",
        submit: "Send my feedback",
      },
    },

    abonnement: {
      page: {
        title: "Subscriptions",
        headerTitle: "Subscription & Pricing",
        headerDescription:
          "Choose the plan that fits you and enable Coaching+ if needed.\nChanges apply immediately in the app (demo: no real payment).",
        currentPlanLabel: "Current plan",
      },
      alerts: {
        success: "✅ Update saved.",
        errorPrefix: "⚠️ Error:",
      },
      current: {
        sectionTitle: "Your subscription",
        activeBadge: "Active plan",
        nextPayment: "Next payment:",
        expiresAt: "Expiration:",
        coachingOption: "Coaching+ option:",
        monthlyTotal: "Monthly total:",
      },
      explainer: {
        title: "What you get",
        items: {
          basic:
            "Basic: Healthy recipes + exercise timer.",
          plus:
            "Plus: AI-personalised recipes (calories, allergens), history & favourites.",
          premium:
            "Premium: Weekly AI meal plans + video form check + priority support.",
          coaching:
            "Coaching+: Video calls / real-life sessions as a monthly add-on.",
        },
      },
      plans: {
        sectionTitle: "Plans",
        badges: {
          recommended: "Recommended",
          active: "Active",
        },
        coachingOptionLabel: "Coaching+ option",
        totalIndicative: "Indicative total:",
        buttons: {
          update: "Update",
          chooseBasic: "Choose Basic",
          choosePlus: "Choose Plus",
          choosePremium: "Choose Premium",
        },
      },
      cards: {
        BASIC: {
          title: "Basic",
          tagline: "Recipes + Timer",
          features: [
            "General recipes",
            "Exercise timer",
            "Email support",
          ],
        },
        PLUS: {
          title: "Plus",
          tagline: "Basic + Personalisation",
          features: [
            "AI-personalised recipes",
            "Advanced filters (allergens, diets)",
            "History & favourites",
          ],
        },
        PREMIUM: {
          title: "Premium",
          tagline: "Plus + AI form check",
          features: [
            "Weekly AI meal plans",
            "Video exercise form correction",
            "Priority support",
          ],
        },
      },
      coachingPlusOptions: {
        none: "Without Coaching+ add-on",
        visio1: "1 video call/month with coach (+€20)",
        real1: "1 in-person session/month (+€40)",
        real4: "Pack of 4 in-person sessions/month (+€140)",
        real8: "Pack of 8 in-person sessions/month (+€240)",
      },
    },

    abonnementSuccess: {
      noSession: {
        title: "Payment",
        text: "Stripe session not found.",
        back: "Back",
      },
      pending: {
        title: "Payment in progress",
        text: "The payment has not been confirmed yet. Please try again in a few moments.",
        back: "Back",
      },
      done: {
        title: "Subscription activated",
        text: "Thank you! Your premium access is now active.",
        totalLabel: "Monthly total: {{amount}} €",
        back: "Back to subscription",
      },
    },

    progress: {
      pageTitle: "My progress",
      pageSubtitle:
        "Add your steps, loads and bodyweight. Your data stays local (cookie).",
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
          help:
            "For lifts, you can also fill the reps field below.",
        },
        date: {
          label: "Date",
        },
        value: {
          label: "Value",
          placeholder:
            "e.g. 8000 (steps) / 60 (kg)",
        },
        reps: {
          label: "Reps (optional, lifts)",
          placeholder: "e.g. 8",
        },
        note: {
          label: "Note (optional)",
          placeholder:
            "e.g. Fast walk, barbell squat, etc.",
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
        noData:
          "No data for this week yet. Add an entry above to see your stats.",
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
        empty:
          "No data yet — start by adding an entry above.",
        type: {
          steps: "Steps",
          load: "Lifts",
          weight: "Weight",
        },
        delete: "Delete",
      },
    },

    recipes: {
      pageTitle: "Recipes",
      pageSubtitle:
        "Healthy base for everyone + personalised AI suggestions based on your filters.",
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
        allergensLabel:
          "Allergies / intolerances (comma-separated)",
        allergensPlaceholder:
          "peanut, lactose, gluten",
        dislikesLabel:
          "Foods you don’t like (to rework)",
        dislikesPlaceholder:
          "broccoli, salmon, tofu...",
        dislikesHelp:
          "AI keeps them but suggests another way to cook them.",
        footerNote:
          "Filters mainly apply to personalised AI suggestions.",
        resetButton: "Reset",
        regenerateButton: "Regenerate",
      },
      saved: {
        title: "Your saved recipes",
        removeButton: "Remove",
      },
      mealsSection: {
        title: "Recipes",
        subtitle:
          "Fixed, stable and tested recipes.",
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
      aiSection: {
        title: "Personalised AI suggestions",
        subtitle:
          "Generated live with AI based on your filters.",
        unavailable: "AI unavailable at the moment.",
        loading: "Generating…",
        badge: "AI personalised",
      },
      detail: {
        notFound: {
          title: "Recipe not found",
          description:
            "Open this recipe from the recipes list.",
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
          description:
            "We keep the ingredient and suggest other ways to cook it:",
        },
        back: "← Back",
      },
    },

    dashboard: {
      header: {
        title: "Welcome 👋",
        subtitle:
          "Quick overview of your progress and today's data.",
      },
      kpi: {
        calories: "Calories today",
        steps: "Steps today",
        lastSession: "Last session",
        manage: "Manage",
      },
      quick: {
        calories: {
          title: "Calories",
          text: "View your history or add today's intake.",
          button: "Manage my calories →",
        },
        workouts: {
          title: "Workouts",
          text:
            "Create, start, or review your past workout sessions.",
          button: "View my sessions →",
        },
      },
    },
  },
} as const;
