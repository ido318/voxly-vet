"use client";

import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import type { Invoice } from "@/types/domain/invoice";

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function SendPaymentLinkButton({ invoice }: { invoice: Invoice }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(invoice.paymentLinkSentAt);

  async function send() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/invoices/${invoice.id}/send-payment-link`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "שליחת קישור התשלום נכשלה");
      return;
    }
    const body = (await res.json()) as { data: Invoice };
    setSentAt(body.data.paymentLinkSentAt);
  }

  if (invoice.status !== "sent") return null;
  if (sentAt) {
    return (
      <span className="text-xs text-[var(--muted)]">קישור תשלום נשלח ב-{fmtTime(sentAt)}</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Btn type="button" size="sm" variant="soft" loading={loading} onClick={() => void send()}>
        שלח קישור תשלום ב-SMS
      </Btn>
      {error ? <span className="text-xs text-[var(--red-600)]">{error}</span> : null}
    </div>
  );
}
