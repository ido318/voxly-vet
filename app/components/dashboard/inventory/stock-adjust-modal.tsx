"use client";

import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input } from "@/components/dashboard/ui/field";
import type { InventoryItem } from "@/types/domain/inventory";

export function StockAdjustModal({
  item,
  onAdjusted,
}: {
  item: InventoryItem;
  onAdjusted: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function adjust(type: "restock" | "adjustment") {
    setLoading(true);
    await fetch(`/api/inventory/${item.id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId: item.clinicId,
        transactionType: type,
        quantityDelta: Number(quantity),
        reason: reason.trim() || null,
      }),
    });
    setQuantity("");
    setReason("");
    setLoading(false);
    onAdjusted();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="שינוי" htmlFor={`stock-qty-${item.id}`} className="w-24">
        <Input
          id={`stock-qty-${item.id}`}
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </Field>
      <Field label="סיבה (אופציונלי)" htmlFor={`stock-reason-${item.id}`} className="w-40">
        <Input
          id={`stock-reason-${item.id}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <Btn type="button" size="sm" variant="soft" loading={loading} disabled={!quantity} onClick={() => void adjust("adjustment")}>
        עדכן
      </Btn>
    </div>
  );
}
