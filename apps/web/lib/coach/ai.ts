export function generateProgrammeFromAnswers(ans: Record<string, any>): { sessions: AiSession[] } {
  const profile = buildProfileFromAnswers(ans);

  // Lecture “souple” des colonnes D..J (avec fallback col_D..col_J si pas d’en-têtes)
  const level =
    normLevel(
      (ans["niveau"] ??
        ans["level"] ??
        ans["experience"] ??
        ans["expérience"] ??
        ans["col_D"]) as string | undefined
    ) || undefined;

  const equipLevel =
    (normEquipLevel(
      (ans["equipLevel"] ??
        ans["matériel"] ??
        ans["materiel"] ??
        ans["equipment_level"] ??
        ans["col_E"]) as string | undefined
    ) || "limited") as "none" | "limited" | "full";

  const timePerSession =
    toNumber(ans["timePerSession"] ?? ans["durée"] ?? ans["duree"] ?? ans["col_F"]) ??
    (profile.age && profile.age > 50 ? 35 : undefined) ??
    45;

  const injuries =
    splitList(ans["injuries"] ?? ans["blessures"]) || undefined;

  const availabilityText = availabilityTextFromAnswersLoose(ans);
  const inferred = inferMaxSessionsFromText(availabilityText);

  const structuredDays =
    toNumber(ans["col_H"]) ??
    toNumber(
      ans["daysPerWeek"] ??
        ans["jours"] ??
        ans["jours/semaine"] ??
        ans["séances/semaine"] ??
        ans["seances/semaine"] ??
        ans["col_I"]
    );

  const maxSessions = Math.max(1, Math.min(6, structuredDays ?? inferred ?? 3));

  const equipItems =
    splitList(ans["equipItems"] ?? ans["équipements"] ?? ans["equipements"] ?? ans["col_J"]) || undefined;

  const enriched = {
    prenom: profile.prenom,
    age: profile.age,
    objectif: profile.objectif, // libellé brut -> affichage
    goal: profile.goal,         // clé normalisée -> logique
    equipLevel,
    timePerSession,
    level,
    injuries,
    equipItems,
    availabilityText,
  } as any;

  if (process.env.NODE_ENV !== "production") {
    console.log("[ai.ts] availabilityText:", availabilityText);
    console.log("[ai.ts] structuredDays:", structuredDays, "inferred:", inferred, "=> maxSessions:", maxSessions);
  }

  // maxSessions = 1..6 (7 est clampé à 6 par design UI)
  return planProgrammeFromProfile(enriched, { maxSessions });
}
