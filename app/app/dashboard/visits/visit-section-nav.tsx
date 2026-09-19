import React from "react";

/**
 * A jump-nav of real <a href="#..."> anchors — not stateful tabs, so it
 * doesn't use the Tabs component (which expects value/onChange state).
 * Visually it matches Tabs' "pill" variant: a bordered segmented strip.
 *
 * ids must stay in sync with the matching `id` attributes in
 * visit-workspace.tsx / [visitId]/page.tsx.
 */
const SECTIONS: { id: string; label: string }[] = [
  { id: "reason-and-pre-visit", label: "רקע לביקור" },
  { id: "anamnesis", label: "אנמנזה" },
  { id: "vitals", label: "מדדים חיוניים" },
  { id: "physical-exam", label: "בדיקה גופנית" },
  { id: "soap", label: "SOAP" },
  { id: "actions", label: "סגירת ביקור" },
];

export function VisitSectionNav() {
  return (
    <nav
      className="inline-flex flex-wrap overflow-hidden"
      style={{ borderRadius: "var(--radius-2)", border: "var(--border-w) solid var(--border-field)" }}
    >
      {SECTIONS.map((section, i) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="px-3 text-[12px] font-semibold whitespace-nowrap hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          style={{
            height: "var(--control-h-sm)",
            lineHeight: "var(--control-h-sm)",
            borderInlineStart: i > 0 ? "var(--border-w) solid var(--border-field)" : "none",
            color: "var(--text-secondary)",
            transition: "var(--transition-color)",
          }}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
