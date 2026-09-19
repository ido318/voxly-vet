import React from "react";
import { AnimalIcon } from "@/components/dashboard/icons";

/**
 * Flat surfaces only — the gradient avatar and the coral Tomer chip are retired,
 * along with the sparkle/robot iconography that used to sit on Tomer's surfaces.
 */

interface AnimalAvatarProps {
  species: string;
  /** Retired: species no longer carries its own colour. */
  color?: string;
  size?: number;
  className?: string;
}

export function AnimalAvatar({ species, size = 32, className = "" }: AnimalAvatarProps) {
  return (
    <span
      className={["inline-flex items-center justify-center rounded-full flex-shrink-0", className].join(" ")}
      style={{
        width: size,
        height: size,
        background: "var(--surface-field)",
        border: "1px solid var(--border-hairline)",
        color: "var(--text-secondary)",
      }}
    >
      <AnimalIcon species={species} size={Math.round(size * 0.55)} />
    </span>
  );
}

interface PersonAvatarProps {
  initials: string;
  size?: number;
  square?: boolean;
  className?: string;
}

export function PersonAvatar({ initials, size = 32, square = false, className = "" }: PersonAvatarProps) {
  return (
    <span
      className={["inline-flex items-center justify-center flex-shrink-0 select-none", className].join(" ")}
      style={{
        width: size,
        height: size,
        borderRadius: square ? "var(--radius-2)" : "var(--radius-round)",
        background: "var(--surface-field)",
        border: "1px solid var(--border-hairline)",
        color: "var(--text-secondary)",
        fontSize: size <= 24 ? 10 : 11.5,
        fontWeight: "var(--w-semibold)",
      }}
    >
      {initials}
    </span>
  );
}

interface TomerChipProps {
  showName?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Tomer is named and credited, never anthropomorphised beyond that. */
export function TomerChip({ showName = true, className = "" }: TomerChipProps) {
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
          background: "var(--active)",
        }}
      />
      {showName && "תומר"}
    </span>
  );
}
