"use client";
import React from "react";
import Link from "next/link";

/**
 * Graphite carries the primary action. Hover is a colour step — never a
 * scale, shadow or brightness filter — and press is a darker colour.
 */

type BtnVariant = "primary" | "ghost" | "soft" | "danger" | "dangerSoft";
type BtnSize = "sm" | "md" | "lg";

const variantStyles: Record<BtnVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--text-on-accent)] border-[var(--accent)] " +
    "hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] " +
    "active:bg-[var(--accent-active)] active:border-[var(--accent-active)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] border-transparent " +
    "hover:bg-[var(--surface-field)] hover:text-[var(--text-primary)] " +
    "active:bg-[var(--surface-active)]",
  soft:
    "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-field)] " +
    "hover:bg-[var(--surface-field)] hover:text-[var(--text-primary)] " +
    "active:bg-[var(--surface-active)]",
  danger:
    "bg-[var(--clay-700)] text-[var(--text-on-accent)] border-[var(--clay-700)] " +
    "hover:bg-[var(--clay-800)] hover:border-[var(--clay-800)]",
  dangerSoft:
    "bg-[var(--surface-raised)] text-[var(--status-critical-text)] border-[var(--clay-300)] " +
    "hover:bg-[var(--status-critical-wash)]",
};

const sizeStyles: Record<BtnSize, string> = {
  sm: "h-[var(--control-h-sm)] px-2 text-[12px] gap-1.5",
  md: "h-[var(--control-h)] px-3 text-[13px] gap-2",
  lg: "h-[var(--control-h-lg)] px-4 text-[13px] gap-2",
};

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  /** Renders as a styled link (next/link) instead of a button — for navigation, not submission. */
  href?: string;
}

export function Btn({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  href,
  ...props
}: BtnProps) {
  const classes = [
    "inline-flex items-center justify-center whitespace-nowrap select-none",
    "font-medium border rounded-[var(--radius-2)]",
    "disabled:opacity-45 disabled:cursor-not-allowed",
    variantStyles[variant],
    sizeStyles[size],
    className,
  ].join(" ");

  const spinner = (
    <span
      className="h-3 w-3 rounded-full flex-shrink-0"
      style={{
        border: "1.5px solid currentColor",
        borderTopColor: "transparent",
        animation: "gvSpin .7s linear infinite",
      }}
    />
  );

  if (href) {
    const isDisabled = disabled || loading;
    return (
      <Link
        href={href}
        className={[classes, isDisabled ? "opacity-45 pointer-events-none" : ""].join(" ")}
        style={{ transition: "var(--transition-color)" }}
        aria-disabled={isDisabled || undefined}
        tabIndex={isDisabled ? -1 : undefined}
        onClick={isDisabled ? (e) => e.preventDefault() : undefined}
      >
        {loading ? spinner : children}
      </Link>
    );
  }

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{ transition: "var(--transition-color)", ...props.style }}
      className={classes}
    >
      {loading ? spinner : children}
    </button>
  );
}
