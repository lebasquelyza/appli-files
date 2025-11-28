"use client";

import React from "react";
import type { AiSession, NormalizedExercise } from "../../../../lib/coach/ai";
import type { Focus } from "./page";
import { useLanguage } from "@/components/LanguageProvider";
import { translateExerciseName } from "@/lib/exerciseI18n";

type Props = {
  base: AiSession;
  exercises: NormalizedExercise[];
  focus: Focus;
  plannedMin: number;
  backHref: string;
};

function stripVariantLetterLocal(s?: string) {
  return String(s || "")
    .replace(/\s*[—–-]\s*[A-Z]\b/gi, "")
    .replace(/\s*·\s*[A-Z]\b/gi, "")
    .replace(/\s*\(([A-Z])\)\s*$/gi, "")
    .trim();
}

function cleanTextLocal(s?: string): string {
  if (!s) return "";
  return String(s)
    .replace(/(?:^|\s*[·•\-|,;]\s*)RIR\s*\d+(?:\.\d+)?/gi, "")
    .replace(/\b[0-4xX]{3,4}\b/g, "")
    .replace(/Tempo\s*:\s*[0-4xX]{3,4}/gi, "")
    .replace(/\s*[·•\-|,;]\s*(?=[·•\-|,;]|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[·•\-|,;]\s*$/g, "")
    .trim();
}

function focusLabelT(focus: Focus, t: any): string {
  switch (focus) {
    case "upper":
      return t("seancePage.focus.upper");
    case "lower":
      return t("seancePage.focus.lower");
    case "full":
      return t("seancePage.focus.full");
    case "mix":
    default:
      return t("seancePage.focus.mix");
  }
}

function Chip({ label, value, title }: { label: string; value: string; title?: string }) {
  if (!value) return null;
  return (
    <span
      title={title || label}
      className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] leading-[14px] text-neutral-800"
    >
      <span className="mr-1 opacity-70">{label}</span> {value}
    </span>
  );
}

const SeancePageViewClient: React.FC<Props> = ({
  base,
  exercises,
  focus,
  plannedMin,
  backHref,
}) => {
  const { t, lang } = useLanguage();

  const displayTitle =
    stripVariantLetterLocal(base.title) || focusLabelT(focus, t);

  return (
    <div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .compact-card {
          padding: 12px;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 1px 0 rgba(17,24,39,.05);
          border: 1px solid #e5e7eb;
        }
        .h1-compact {
          margin-bottom:2px;
          font-size: clamp(20px, 2.2vw, 24px);
          line-height:1.15;
          font-weight:800;
        }
        .lead-compact {
          margin-top:4px;
          font-size: clamp(12px, 1.6vw, 14px);
          line-height:1.35;
          color:#4b5563;
        }
        .exoname {
          font-size: 15.5px;
          line-height:1.25;
          font-weight:700;
        }
        .chips {
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          margin-top:8px;
        }
        .btn-ghost {
          background:#fff;
          color:#111827;
          border:1px solid #e5e7eb;
          border-radius:8px;
          padding:6px 10px;
          font-weight:600;
        }
      `,
        }}
      />

      {/* HEADER */}
      <div className="mb-2 flex items-center justify-between no-print" style={{ paddingInline: 12 }}>
        <a href={backHref} className="btn-ghost">
          {t("seancePage.backButton")}
        </a>
        <div className="text-xs text-gray-400">
          {t("seancePage.aiBadge")}
        </div>
      </div>

      <div
        className="mx-auto w-full"
        style={{ maxWidth: 640, paddingInline: 12, paddingBottom: 24 }}
      >
        {/* TITLE */}
        <div className="page-header">
          <div>
            <h1 className="h1-compact">{displayTitle}</h1>
            <p className="lead-compact">
              {plannedMin} {t("seancePage.plannedMinSuffix")} · {base.type}
            </p>
          </div>
        </div>

        {/* EXERCISES */}
        <section className="section" style={{ marginTop: 12 }}>
          <div className="grid gap-3">
            {exercises.map((ex, i) => {
              const translatedName = translateExerciseName(ex.name, lang);

              const reps = cleanTextLocal(
                ex.reps
                  ? String(ex.reps)
                  : ex.durationSec
                  ? `${ex.durationSec}s`
                  : ""
              );
              const rest = cleanTextLocal(ex.rest || "");

              return (
                <article key={i} className="compact-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="exoname">{translatedName}</div>
                  </div>

                  <div className="chips">
                    {typeof ex.sets === "number" && (
                      <Chip
                        label="🧱"
                        value={`${ex.sets} ${t("seancePage.chips.setsLabel")}`}
                        title={t("seancePage.chips.setsLabel")}
                      />
                    )}
                    {reps && (
                      <Chip
                        label="🔁"
                        value={reps}
                        title={t("seancePage.chips.repsLabel")}
                      />
                    )}
                    {rest && (
                      <Chip
                        label="⏲️"
                        value={rest}
                        title={t("seancePage.chips.restLabel")}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SeancePageViewClient;
