"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/login/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-8">
        <p className="text-[13px]" style={{ color: "var(--status-done-text)" }} role="status">
          אם קיים חשבון עם האימייל הזה, נשלח אליו קישור לאיפוס סיסמה.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-[13px]"
          style={{ color: "var(--text-link)" }}
        >
          חזרה להתחברות
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-[12px]"
          style={{ color: "var(--text-secondary)", fontWeight: "var(--w-medium)" }}
        >
          אימייל
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          dir="ltr"
          className="w-full px-3 text-[13px] outline-none focus:border-[var(--border-focus)]"
          style={{
            height: "var(--field-h)",
            borderRadius: "var(--radius-2)",
            border: "1px solid var(--border-field)",
            background: "var(--surface-raised)",
            color: "var(--text-primary)",
            transition: "var(--transition-color)",
          }}
        />
      </div>

      {error ? (
        <p className="text-[13px]" style={{ color: "var(--status-critical-text)" }} role="alert">
          שגיאה: {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 text-[13px] hover:bg-[var(--accent-hover)] disabled:opacity-45"
        style={{
          height: "var(--control-h-lg)",
          borderRadius: "var(--radius-2)",
          background: "var(--accent)",
          color: "var(--text-on-accent)",
          fontWeight: "var(--w-medium)",
          transition: "var(--transition-color)",
        }}
      >
        {loading ? "שולח..." : "שליחת קישור לאיפוס"}
      </button>

      <Link
        href="/login"
        className="block text-center text-[13px]"
        style={{ color: "var(--text-link)" }}
      >
        חזרה להתחברות
      </Link>
    </form>
  );
}
