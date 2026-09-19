"use client";

import { Btn } from "@/components/dashboard/ui/btn";
import type { Invoice } from "@/types/domain/invoice";

function fmtMoney(value: number) {
  return `₪${value.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InvoiceDraft({ invoice }: { invoice: Invoice }) {
  async function issueInvoice() {
    await fetch(`/api/invoices/${invoice.id}/issue`, { method: "POST" });
    window.location.reload();
  }

  if (invoice.status !== "draft") return null;

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[var(--ink)]">טיוטת חשבונית</p>
        <p className="text-xs font-semibold tabular-nums text-[var(--ink)]">{fmtMoney(invoice.total)}</p>
      </div>
      <ul className="mb-3 space-y-1">
        {invoice.items.map((item, index) => (
          <li key={`${item.description}-${index}`} className="flex justify-between gap-3 text-xs text-[var(--ink-2)]">
            <span>{item.description}</span>
            <span className="tabular-nums">{fmtMoney(item.quantity * item.unitPrice)}</span>
          </li>
        ))}
      </ul>
      <Btn type="button" size="sm" onClick={() => void issueInvoice()}>
        הפק חשבונית
      </Btn>
    </div>
  );
}
