"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { useToast } from "@/components/dashboard/ui/toast";
import { PlusIcon, XIcon } from "@/components/dashboard/icons";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/types/domain/invoice";

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

function fmtMoney(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

const EMPTY_LINE: InvoiceLineItem = { description: "", quantity: 1, unitPrice: 0 };

export function InvoicesSection({
  clinicId,
  customerId,
  petId,
}: {
  clinicId: string;
  customerId: string;
  petId?: string | null;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<InvoiceLineItem[]>([{ ...EMPTY_LINE }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchInvoices = useCallback(async () => {
    const params = new URLSearchParams({ customerId });
    if (petId) params.set("petId", petId);
    const res = await fetch(`/api/invoices?${params.toString()}`);
    if (res.ok) {
      const d = await res.json() as { data: { items: Invoice[] } };
      setInvoices(d.data.items ?? []);
    }
    setLoading(false);
  }, [customerId, petId]);

  useEffect(() => { void fetchInvoices(); }, [fetchInvoices]);

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  async function submitInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validItems = items.filter((item) => item.description.trim().length > 0 && item.quantity > 0);
    if (validItems.length === 0) {
      toast("יש להוסיף לפחות שורה אחת עם תיאור וכמות", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          customerId,
          petId: petId ?? null,
          items: validItems,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "הפקת החשבונית נכשלה");
      }
      toast("החשבונית הופקה", "success");
      setShowForm(false);
      setItems([{ ...EMPTY_LINE }]);
      setNotes("");
      await fetchInvoices();
    } catch (error) {
      toast(error instanceof Error ? error.message : "הפקת החשבונית נכשלה", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(invoice: Invoice, status: InvoiceStatus) {
    setUpdatingId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: invoice.version, status }),
      });
      if (!res.ok) throw new Error();
      await fetchInvoices();
    } catch {
      toast("עדכון סטטוס החשבונית נכשל", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          חשבוניות וחיובים ({loading ? "…" : invoices.length})
        </p>
        <Btn size="sm" variant="ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "ביטול" : "+ הפק חשבונית"}
        </Btn>
      </div>

      {showForm && (
        <form onSubmit={submitInvoice} className="space-y-2 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={item.description}
                onChange={(e) => setItems((cur) => cur.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))}
                placeholder="תיאור"
                className="h-8 flex-1 min-w-0 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs outline-none focus:border-[var(--brand-400)]"
              />
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={item.quantity}
                onChange={(e) => setItems((cur) => cur.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) } : it))}
                className="h-8 w-14 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-1.5 text-xs outline-none focus:border-[var(--brand-400)]"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={item.unitPrice}
                onChange={(e) => setItems((cur) => cur.map((it, idx) => idx === i ? { ...it, unitPrice: Number(e.target.value) } : it))}
                className="h-8 w-20 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-1.5 text-xs outline-none focus:border-[var(--brand-400)]"
              />
              {items.length > 1 && (
                <button type="button" onClick={() => setItems((cur) => cur.filter((_, idx) => idx !== i))} className="text-[var(--faint)] hover:text-[var(--red-600)]">
                  <XIcon size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((cur) => [...cur, { ...EMPTY_LINE }])}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-600)] hover:underline"
          >
            <PlusIcon size={11} /> הוסף שורה
          </button>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות (אופציונלי)"
            rows={2}
            className="w-full rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs outline-none focus:border-[var(--brand-400)]"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-semibold text-[var(--ink)]">{fmtMoney(total)}</span>
            <Btn type="submit" size="sm" loading={submitting}>הפק חשבונית</Btn>
          </div>
        </form>
      )}

      {loading ? (
        <Skeleton className="h-16" />
      ) : invoices.length === 0 ? (
        <p className="text-sm text-[var(--faint)]">אין חשבוניות עדיין</p>
      ) : (
        <div className="rounded-[var(--r-lg)] border border-[var(--line)] divide-y divide-[var(--line-2)]">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--ink)]">
                  #{inv.invoiceNumber} · {fmtMoney(inv.total)}
                </p>
                <p className="text-xs text-[var(--muted)]">{fmtDate(inv.issuedAt)}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Badge color={STATUS_COLOR[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                {inv.status === "draft" && (
                  <Btn size="sm" variant="soft" loading={updatingId === inv.id} onClick={() => changeStatus(inv, "sent")}>שלח</Btn>
                )}
                {inv.status === "sent" && (
                  <Btn size="sm" variant="soft" loading={updatingId === inv.id} onClick={() => changeStatus(inv, "paid")}>סמן כשולם</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
