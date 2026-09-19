"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים");
      return;
    }

    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-[12px]"
          style={{ color: "var(--text-secondary)", fontWeight: "var(--w-medium)" }}
        >
          סיסמה חדשה
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-[12px]"
          style={{ color: "var(--text-secondary)", fontWeight: "var(--w-medium)" }}
        >
          אימות סיסמה
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
        {loading ? "מעדכן..." : "עדכון סיסמה"}
      </button>
    </form>
  );
}
