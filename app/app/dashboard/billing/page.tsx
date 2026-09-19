"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { CreditCardIcon } from "@/components/dashboard/icons";
import { InvoiceDraft } from "@/components/dashboard/billing/invoice-draft";
import { PaymentForm } from "@/components/dashboard/billing/payment-form";
import { SendPaymentLinkButton } from "@/components/dashboard/billing/send-payment-link-button";
import type { Invoice, InvoiceStatus } from "@/types/domain/invoice";
import { Alert } from "@/components/dashboard/ui/alert";
import { Btn } from "@/components/dashboard/ui/btn";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "טיוטה",
  sent: "נשלח",
  paid: "שולם",
  void: "בוטל",
};

const STATUS_COLOR: Record<InvoiceStatus, "muted" | "amber" | "green" | "red"> = {
  draft: "muted",
  sent: "amber",
  paid: "green",
  void: "red",
};

const STATUS_FILTERS: Array<{ value: InvoiceStatus | "all"; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "draft", label: "טיוטה" },
  { value: "sent", label: "נשלח" },
  { value: "paid", label: "שולם" },
  { value: "void", label: "בוטל" },
];

function fmtMoney(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/invoices");
      if (!res.ok) {
        setLoadError("טעינת החשבוניות נכשלה.");
        return;
      }
      const d = await res.json() as { data: { items: Invoice[] } };
      setInvoices(d.data.items ?? []);
    } catch {
      setLoadError("טעינת החשבוניות נכשלה. בדוק/י את החיבור ונסה/י שוב.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter);
  const totalOutstanding = invoices
    .filter((inv) => inv.status === "sent")
    .reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold text-[var(--ink)]">חיובים</h1>
        <Card className="px-4 py-2.5">
          <p className="text-[11px] text-[var(--muted)]">חוב פתוח (נשלח, טרם שולם)</p>
          {/* An empty invoice list sums to 0, so a failed load used to state
              ₪0.00 outstanding as fact — a confident, wrong financial figure.
              Say we do not know instead. */}
          <p className="text-[18px] font-semibold tabular-nums text-[var(--amber-600)]">
            {loading || loadError ? "—" : fmtMoney(totalOutstanding)}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={[
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
              filter === f.value
                ? "border-[var(--brand-400)] bg-[var(--brand-100)] text-[var(--brand-800)]"
                : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loadError && (
        <Alert tone="critical" title="שגיאה בטעינת נתונים">
          {loadError}
          <div className="mt-2">
            <Btn type="button" size="sm" variant="soft" onClick={() => void fetchData()}>
              נסה שוב
            </Btn>
          </div>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 && !loadError ? (
        <EmptyState icon={<CreditCardIcon size={32} />} title="אין חשבוניות" subtitle="חשבוניות שהופקו יופיעו כאן" />
      ) : (
        <Card noPad className="overflow-hidden">
          <div className="divide-y divide-[var(--line-2)]">
            {filtered.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-[var(--ink)]">#{inv.invoiceNumber}</p>
                  <Link
                    href={`/dashboard/clients?customerId=${inv.customerId}`}
                    className="text-xs text-[var(--brand-600)] hover:underline"
                  >
                    {inv.customerName ?? inv.customerId}
                  </Link>
                  {inv.petName && <span className="text-xs text-[var(--muted)]"> · {inv.petName}</span>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <p className="text-xs text-[var(--muted)]">{fmtDate(inv.issuedAt)}</p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">{fmtMoney(inv.total)}</p>
                  <Badge color={STATUS_COLOR[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  {inv.status === "draft" ? <InvoiceDraft invoice={inv} /> : null}
                  {inv.status === "sent" ? (
                    <div className="flex flex-col items-end gap-2">
                      <PaymentForm clinicId={inv.clinicId} invoiceId={inv.id} />
                      <SendPaymentLinkButton invoice={inv} />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
