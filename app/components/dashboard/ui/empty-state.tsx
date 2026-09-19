import React from "react";

interface EmptyStateProps {
  /** Retired: empty states are text-first, so this is accepted but not drawn. */
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ title, subtitle, action, compact = false, className = "" }: EmptyStateProps) {
  return (
    <div
      className={["flex flex-col gap-1", className].join(" ")}
      style={{ padding: compact ? "var(--space-4) 0" : "var(--space-6) 0" }}
    >
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{title}</p>
      {subtitle && (
        <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>{subtitle}</p>
      )}
      {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
    </div>
  );
}
