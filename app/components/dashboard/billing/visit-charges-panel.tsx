"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Badge } from "@/components/dashboard/ui/badge";
import type { PriceListItem } from "@/types/domain/price-list-item";
import type { VisitCharge } from "@/types/domain/visit-charge";

const CUSTOM_ITEM_VALUE = "__custom__";

export function VisitChargesPanel({
  visitId,
  clinicId,
  charges,
}: {
  visitId: string;
  clinicId: string;
  charges: VisitCharge[];
}) {
  const router = useRouter();
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(CUSTOM_ITEM_VALUE);
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saveToPriceList, setSaveToPriceList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/price-list");
      if (res.ok) {
        const body = (await res.json()) as { data: { items: PriceListItem[] } };
        setPriceList(body.data.items.filter((item) => item.active));
      }
    })();
  }, []);

  function selectPriceListItem(itemId: string) {
    setSelectedItemId(itemId);
    setSaveToPriceList(false);
    if (itemId === CUSTOM_ITEM_VALUE) {
      setDescription("");
      setUnitPrice("");
      return;
    }
    const item = priceList.find((entry) => entry.id === itemId);
    if (item) {
      setDescription(item.name);
      setUnitPrice(String(item.defaultPrice));
    }
  }

  async function addCharge() {
    setLoading(true);
    setError(null);

    const chargeRes = await fetch(`/api/visits/${visitId}/charges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        quantity: 1,
        unitPrice: Number(unitPrice),
        sourceType: "manual",
      }),
    });
    if (!chargeRes.ok) {
      setLoading(false);
      setError("הוספת החיוב נכשלה");
      return;
    }

    if (selectedItemId === CUSTOM_ITEM_VALUE && saveToPriceList && description.trim()) {
      const priceListRes = await fetch("/api/price-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, name: description, defaultPrice: Number(unitPrice) }),
      });
      if (!priceListRes.ok) {
        // The charge itself was already created successfully — only the
        // catalog save failed (e.g. requires owner/admin) — surface that
        // distinctly so the user doesn't think it silently succeeded.
        setLoading(false);
        setError("החיוב נוסף, אך שמירתו במחירון נכשלה (נדרשת הרשאת בעלים/מנהל)");
        router.refresh();
        return;
      }
    }

    setSelectedItemId(CUSTOM_ITEM_VALUE);
    setDescription("");
    setUnitPrice("");
    setSaveToPriceList(false);
    setLoading(false);
    router.refresh();
  }

  async function review(chargeId: string) {
    await fetch(`/api/charges/${chargeId}/review`, { method: "POST" });
    router.refresh();
  }

  async function createInvoice() {
    await fetch(`/api/visits/${visitId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Created from reviewed visit charges" }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {charges.length === 0 ? (
          <li className="text-sm text-[var(--faint)]">אין חיובים לביקור.</li>
        ) : charges.map((charge) => (
          <li key={charge.id} className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
            <div>
              <p className="font-semibold text-[var(--ink)]">{charge.description}</p>
              <p className="text-[var(--muted)]">₪{(charge.quantity * charge.unitPrice).toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={charge.status === "pending" ? "amber" : charge.status === "reviewed" ? "green" : "muted"}>
                {charge.status}
              </Badge>
              {charge.status === "pending" ? (
                <Btn type="button" size="sm" variant="soft" onClick={() => void review(charge.id)}>
                  אשר חיוב
                </Btn>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-2 border-t border-[var(--line-2)] pt-3">
        <select
          value={selectedItemId}
          onChange={(event) => selectPriceListItem(event.target.value)}
          className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
        >
          <option value={CUSTOM_ITEM_VALUE}>פריט מותאם אישית...</option>
          {priceList.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · ₪{item.defaultPrice}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="תיאור חיוב"
            className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            placeholder="מחיר"
            className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
          />
          <Btn type="button" size="sm" loading={loading} disabled={!description.trim() || !unitPrice} onClick={() => void addCharge()}>
            הוסף
          </Btn>
        </div>
        {selectedItemId === CUSTOM_ITEM_VALUE ? (
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={saveToPriceList}
              onChange={(event) => setSaveToPriceList(event.target.checked)}
            />
            שמור פריט זה במחירון לפעמים הבאות (אחרת זה חיוב חד-פעמי ללקוח הזה בלבד)
          </label>
        ) : null}
        {error ? <p className="text-xs text-[var(--red-600)]">{error}</p> : null}
      </div>
      {charges.some((charge) => charge.status === "reviewed") ? (
        <Btn type="button" size="sm" onClick={() => void createInvoice()}>
          צור חשבונית מהחיובים המאושרים
        </Btn>
      ) : null}
    </div>
  );
}
