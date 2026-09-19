import React from "react";

/**
 * Urgency stays on its real 1–10 scale. The old four-step orange ramp is gone:
 * the meter reads secondary ink until it crosses 6, then critical red.
 */

interface UrgencyMeterProps {
  value: number;
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export function UrgencyMeter({ value, showLabel = true, compact = false, className = "" }: UrgencyMeterProps) {
  const clamped = Math.max(0, Math.min(10, value));
  const critical = clamped >= 6;
  const fill = critical ? "var(--status-critical-text)" : "var(--text-secondary)";

  return (
    <span className={["inline-flex items-center gap-2", className].join(" ")}>
      <span className="inline-flex gap-[2px]" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="block"
            style={{
              width: 3,
              height: compact ? 10 : 12,
              borderRadius: "1px",
              background: i < clamped ? fill : "var(--border-hairline)",
            }}
          />
        ))}
      </span>
      {showLabel && (
        <span
          className="gv-data text-[12px]"
          style={{
            fontWeight: "var(--w-medium)",
            color: critical ? "var(--status-critical-text)" : "var(--text-muted)",
          }}
        >
          {clamped}/10
        </span>
      )}
    </span>
  );
}
