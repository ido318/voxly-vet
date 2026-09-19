"use client";

import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import type { PaymentMethod } from "@/types/domain/payment";

export function PaymentForm({ clinicId, invoiceId }: { clinicId: string; invoiceId: string }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, invoiceId, amount: Number(amount), method }),
    });
    setLoading(false);
    setAmount("");
  }

  return (
    <div className="flex gap-2">
      <input
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="סכום"
        className="h-9 w-28 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm"
      />
      <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm">
        <option value="card">אשראי</option>
        <option value="cash">מזומן</option>
        <option value="bit">ביט</option>
        <option value="bank_transfer">העברה</option>
        <option value="other">אחר</option>
      </select>
      <Btn type="button" size="sm" loading={loading} disabled={!amount} onClick={() => void submit()}>
        רשום תשלום
      </Btn>
    </div>
  );
}
