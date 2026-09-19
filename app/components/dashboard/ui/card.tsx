import React from "react";

/**
 * A white sheet lifted by a hairline ring plus one soft shadow — never a heavy
 * border, and never nested inside another card.
 */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Retired: static UI gets --shadow-raised at most, and hover never lifts. */
  hover?: boolean;
  noPad?: boolean;
}

export function Card({ hover = false, noPad = false, children, className = "", style, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={[noPad ? "" : "p-4", hover ? "cursor-pointer" : "", className].join(" ")}
      style={{
        background: "var(--surface-raised)",
        borderRadius: "var(--radius-3)",
        boxShadow: "var(--shadow-raised)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A group heading that sits outside the sheet, above the rows it labels. */
export function SectionHeading({
  title,
  count,
  action,
  className = "",
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={["flex items-baseline gap-2", className].join(" ")}
      style={{ paddingBottom: "var(--label-gap)", borderBottom: "var(--rule-strong)" }}
    >
      <h2 className="gv-section-label" style={{ color: "var(--text-muted)" }}>{title}</h2>
      {count != null && (
        <span className="gv-data text-[12px]" style={{ color: "var(--text-faint)" }}>{count}</span>
      )}
      {action && <span className="ms-auto text-[12px]">{action}</span>}
    </div>
  );
}
