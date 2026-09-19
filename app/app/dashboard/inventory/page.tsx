"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input } from "@/components/dashboard/ui/field";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { SkeletonRow } from "@/components/dashboard/ui/skeleton";
import { PackageIcon } from "@/components/dashboard/icons";
import { InventoryTable } from "@/components/dashboard/inventory/inventory-table";
import { StockAdjustModal } from "@/components/dashboard/inventory/stock-adjust-modal";
import type { InventoryItem } from "@/types/domain/inventory";
import type { MeResponse } from "@/types/api/me";
import { Alert } from "@/components/dashboard/ui/alert";
import { useToast } from "@/components/dashboard/ui/toast";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // `load()` used to be `if (res.ok) { … }` with no else and no catch, and the
  // /api/me call was swallowed the same way — which left clinicId null and
  // made createItem a silent no-op (`if (!clinicId) return;`). A network throw
  // also escaped as an unhandled rejection with loading stuck true.
  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      const [meRes, invRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/inventory"),
      ]);

      if (meRes.ok) {
        const me = await meRes.json() as { data: MeResponse };
        setClinicId(me.data.profile.defaultClinicId ?? me.data.memberships[0]?.clinicId ?? null);
      } else {
        setLoadError("טעינת פרטי המרפאה נכשלה — לא ניתן להוסיף פריטים.");
      }

      if (invRes.ok) {
        const data = await invRes.json() as { data: { items: InventoryItem[] } };
        setItems(data.data.items);
      } else {
        setLoadError("טעינת המלאי נכשלה.");
      }
    } catch {
      setLoadError("טעינת המלאי נכשלה. בדוק/י את החיבור ונסה/י שוב.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function createItem() {
    if (!clinicId) {
      toast("לא ניתן להוסיף פריט — פרטי המרפאה לא נטענו", "error");
      return;
    }
    setSaving(true);
    try {
      // The response was never inspected at all: a 400 or 403 cleared the form
      // and reloaded, so a rejected item looked exactly like a saved one.
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, name, quantityOnHand: Number(quantity || 0) }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        toast(payload?.error?.message ?? "הוספת הפריט נכשלה", "error");
        return;
      }
      // Only clear the form once the item really exists.
      setName("");
      setQuantity("");
      toast("הפריט נוסף", "success");
      await fetchData();
    } catch {
      toast("הוספת הפריט נכשלה. בדוק/י את החיבור", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <h1 className="text-[28px] font-semibold" style={{ color: "var(--text-primary)" }}>מלאי</h1>
      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <Field label="שם פריט" htmlFor="newInventoryItemName">
            <Input
              id="newInventoryItemName"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="כמות" htmlFor="newInventoryItemQuantity">
            <Input
              id="newInventoryItemQuantity"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Btn type="button" loading={saving} disabled={!name.trim() || saving} onClick={() => void createItem()}>הוסף פריט</Btn>
        </div>
      </Card>
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
        <Card noPad>
          <div className="divide-y divide-[var(--border-row)]">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </Card>
      ) : items.length === 0 && !loadError ? (
        <EmptyState
          icon={<PackageIcon size={32} />}
          title="אין פריטי מלאי עדיין"
          subtitle="פריטים שתוסיפו יופיעו כאן עם מצב המלאי שלהם"
        />
      ) : (
        <>
          <InventoryTable items={items} />
          <Card noPad>
            <div className="divide-y divide-[var(--border-row)]">
              {items.map((item) => (
                <div key={`${item.id}-adjust`} className="px-4 py-3">
                  <StockAdjustModal item={item} onAdjusted={() => void fetchData()} />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
