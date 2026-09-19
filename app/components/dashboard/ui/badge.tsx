import React from "react";

/**
 * Four status hues are the only colour beyond graphite and teal: green (done),
 * amber (awaiting a human), red (escalation), steel (neutral classification).
 * The old brand/coral colours map onto these tones.
 */

type BadgeTone = "done" | "pending" | "critical" | "info" | "neutral";

/** Retired colour names, kept so existing call sites keep compiling. */
type LegacyColor = "brand" | "coral" | "amber" | "red" | "green" | "muted";

const LEGACY_TONE: Record<LegacyColor, BadgeTone> = {
  brand: "info",
  coral: "critical",
  amber: "pending",
  red: "critical",
  green: "done",
  muted: "neutral",
};

const toneStyles: Record<BadgeTone, { color: string; background: string }> = {
  done:     { color: "var(--status-done-text)",     background: "var(--status-done-wash)" },
  pending:  { color: "var(--status-pending-text)",  background: "var(--status-pending-wash)" },
  critical: { color: "var(--status-critical-text)", background: "var(--status-critical-wash)" },
  info:     { color: "var(--status-info-text)",     background: "var(--status-info-wash)" },
  neutral:  { color: "var(--status-neutral-text)",  background: "var(--status-neutral-wash)" },
};

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** @deprecated use `tone` — mapped onto the four status hues. */
  color?: LegacyColor;
  dot?: boolean;
  /** Retired: the system has no pulsing status dot. Accepted, never rendered. */
  pulse?: boolean;
  plain?: boolean;
  className?: string;
}

export function Badge({
  children,
  tone,
  color,
  dot = false,
  plain = false,
  className = "",
}: BadgeProps) {
  const resolved: BadgeTone = tone ?? (color ? LEGACY_TONE[color] : "neutral");
  const t = toneStyles[resolved];

  if (plain) {
    return (
      <span
        className={["whitespace-nowrap text-[12px]", className].join(" ")}
        style={{
          fontWeight: resolved === "neutral" ? "var(--w-regular)" : "var(--w-semibold)",
          color: resolved === "neutral" ? "var(--text-muted)" : t.color,
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={["inline-flex items-center gap-1 px-2 whitespace-nowrap text-[12px]", className].join(" ")}
      style={{
        height: "var(--chip-h)",
        borderRadius: "var(--radius-1)",
        background: t.background,
        color: t.color,
        fontWeight: "var(--w-semibold)",
      }}
    >
      {dot && (
        <span
          className="w-[5px] h-[5px] rounded-full flex-shrink-0"
          style={{ background: "currentColor" }}
        />
      )}
      {children}
    </span>
  );
}
