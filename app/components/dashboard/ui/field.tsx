import React from "react";

/**
 * One label+control+error pattern for every form in the app. The control
 * primitives are thin styled wrappers — value/onChange pass through
 * unchanged, so adopting them is a markup change, never a state-shape one.
 */

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, className = "" }: FieldProps) {
  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      <label
        htmlFor={htmlFor}
        className="text-[12.5px]"
        style={{ color: "var(--text-secondary)", fontWeight: "var(--w-medium)" }}
      >
        {label}
        {required && <span style={{ color: "var(--status-critical-text)" }}> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[12px]" style={{ color: "var(--status-critical-text)" }}>{error}</p>
      ) : hint ? (
        <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>{hint}</p>
      ) : null}
    </div>
  );
}

const controlClass =
  "w-full px-3 outline-none focus:border-[var(--border-focus)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export function Input({ className = "", style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[controlClass, className].join(" ")}
      style={{
        height: "var(--field-h)",
        borderRadius: "var(--radius-2)",
        border: "1px solid var(--border-field)",
        background: "var(--surface-raised)",
        color: "var(--text-primary)",
        fontSize: "13px",
        transition: "var(--transition-color)",
        ...style,
      }}
    />
  );
}

export function Select({ className = "", style, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[controlClass, className].join(" ")}
      style={{
        height: "var(--field-h)",
        borderRadius: "var(--radius-2)",
        border: "1px solid var(--border-field)",
        background: "var(--surface-raised)",
        color: "var(--text-primary)",
        fontSize: "13px",
        transition: "var(--transition-color)",
        ...style,
      }}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = "", style, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[controlClass, "py-2", className].join(" ")}
      style={{
        minHeight: "80px",
        borderRadius: "var(--radius-2)",
        border: "1px solid var(--border-field)",
        background: "var(--surface-raised)",
        color: "var(--text-primary)",
        fontSize: "13px",
        transition: "var(--transition-color)",
        ...style,
      }}
    />
  );
}
