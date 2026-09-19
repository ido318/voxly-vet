import React from "react";

/**
 * All 12 appointment-type keys and their Hebrew labels are preserved, including
 * the `vaccine` / `followup` legacy aliases. The eight-colour palette they used
 * to carry collapses onto the system's four status hues, drawn as a 6px square
 * mark rather than a filled pill.
 */

export type VisitType =
  | "checkup"
  | "vaccine"
  | "surgery"
  | "neutering"
  | "home_visit"
  | "phone_consultation"
  | "followup"
  | "consultation"
  | "vaccination"
  | "urgent"
  | "follow_up"
  | "other";

const VISIT_TYPES: Record<VisitType, { label: string; color: string }> = {
  checkup:            { label: "בדיקה",       color: "var(--type-checkup)" },
  consultation:       { label: "ייעוץ",       color: "var(--type-consultation)" },
  vaccination:        { label: "חיסון",       color: "var(--type-vaccination)" },
  vaccine:            { label: "חיסון",       color: "var(--type-vaccination)" },
  surgery:            { label: "ניתוח",       color: "var(--type-surgery)" },
  neutering:          { label: "עיקור/סירוס", color: "var(--type-neutering)" },
  home_visit:         { label: "ביקור בית",   color: "var(--type-home-visit)" },
  phone_consultation: { label: "ייעוץ טלפוני", color: "var(--type-phone-consultation)" },
  follow_up:          { label: "מעקב",        color: "var(--type-follow-up)" },
  followup:           { label: "מעקב",        color: "var(--type-follow-up)" },
  urgent:             { label: "דחוף",        color: "var(--type-urgent)" },
  other:              { label: "אחר",         color: "var(--type-other)" },
};

interface TypePillProps {
  type: string;
  /** Retired: the mark's colour already classifies the type. */
  showHomeIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function TypePill({ type, showLabel = true, className = "" }: TypePillProps) {
  const t = VISIT_TYPES[type as VisitType] ?? VISIT_TYPES.other;
  const label = VISIT_TYPES[type as VisitType]?.label ?? type;

  return (
    <span
      className={["inline-flex items-center gap-2 whitespace-nowrap text-[12px]", className].join(" ")}
      style={{ color: "var(--text-secondary)" }}
    >
      <span
        aria-hidden="true"
        className="flex-shrink-0"
        style={{
          width: "var(--mark-size)",
          height: "var(--mark-size)",
          borderRadius: "1px",
          background: t.color,
        }}
      />
      {showLabel && label}
    </span>
  );
}

export { VISIT_TYPES };
