"use client";

import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";

type Props = {
  visitId: string;
  hasSummary: boolean;
  hasPrescriptions: boolean;
};

type ShareResult = { url: string; recipientPhone: string };

export function VisitShareSection({ visitId, hasSummary, hasPrescriptions }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  const nothingToSend = !hasSummary && !hasPrescriptions;

  async function sendShare() {
    setLoading(true);
    setError(null);
    setCopied(false);

    const response = await fetch(`/api/visits/${visitId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "שליחת הקישור נכשלה");
      return;
    }
    const payload = (await response.json()) as { data: ShareResult };
    setResult(payload.data);
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        שליחת קישור מאובטח ללקוח ב-SMS עם סיכום הביקור והמרשמים.
      </p>

      {nothingToSend ? (
        <p className="text-sm text-[var(--amber-600)]">
          כדי לשלוח, צריך קודם סיכום ביקור או מרשם פעיל.
        </p>
      ) : null}

      {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}

      {result ? (
        <div className="rounded-[var(--radius-3)] border border-[var(--brand-200)] bg-[var(--brand-50)] p-3 text-sm">
          <p className="font-semibold text-[var(--accent-hover)]">
            נשלח ל-{result.recipientPhone}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[var(--accent)] underline"
            >
              {result.url}
            </a>
            <Btn size="sm" variant="soft" onClick={copyLink}>{copied ? "הועתק" : "העתק"}</Btn>
          </div>
        </div>
      ) : null}

      <Btn size="sm" loading={loading} disabled={nothingToSend} onClick={sendShare}>
        {result ? "שלח שוב" : "שלח סיכום ומרשם ללקוח ב-SMS"}
      </Btn>
    </div>
  );
}
