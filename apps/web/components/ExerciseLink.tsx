"use client";

import { useState } from "react";
import DemoBrowser from "./DemoBrowser";
import type { NormalizedExercise } from "../lib/coach/ai";

export default function ExerciseLink({
  exercise,
  children,
}: {
  exercise: NormalizedExercise;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const query = `${exercise.name} exercice`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card-link text-left w-full"
        title={`Voir la démonstration : ${exercise.name}`}
      >
        {children}
      </button>

      {open && (
        <DemoBrowser
          initialQuery={query}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
