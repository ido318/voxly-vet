"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { safeNextPath } from "@/lib/safe-next-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(safeNextPath(nextPath));
    router.refresh();
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

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-[12px]"
          style={{ color: "var(--text-secondary)", fontWeight: "var(--w-medium)" }}
        >
          סיסמה
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
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
        <div className="mt-1.5 flex justify-end">
          <Link href="/login/forgot-password" className="text-[12px]" style={{ color: "var(--text-link)" }}>
            שכחתי סיסמה
          </Link>
        </div>
      </div>

      {error ? (
        <p className="text-[13px]" style={{ color: "var(--status-critical-text)" }} role="alert">
          שגיאת התחברות: {error}
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
        {loading ? "מתחבר..." : "התחברות"}
      </button>
    </form>
  );
}
