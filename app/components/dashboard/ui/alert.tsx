import React from "react";

/**
 * A block-level banner for form/fetch errors — the same four status washes
 * Badge uses, just laid out for a sentence instead of a chip. Replaces the
 * hand-rolled red boxes that used to appear per-screen.
 */

type AlertTone = "critical" | "pending" | "info" | "done";

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ tone = "info", title, children, className = "" }: AlertProps) {
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={["flex flex-col gap-1 px-4 py-3", className].join(" ")}
      style={{
        borderRadius: "var(--radius-2)",
        background: `var(--status-${tone}-wash)`,
        color: `var(--status-${tone}-text)`,
      }}
    >
      {title && (
        <p className="text-[13px]" style={{ fontWeight: "var(--w-semibold)" }}>{title}</p>
      )}
      <div className="text-[12.5px]" style={{ fontWeight: "var(--w-regular)" }}>{children}</div>
    </div>
  );
}
