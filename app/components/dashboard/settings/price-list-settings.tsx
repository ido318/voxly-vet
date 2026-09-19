"use client";

import { useEffect, useState } from "react";
import { Field, Input } from "@/components/dashboard/ui/field";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import type { PriceListItem } from "@/types/domain/price-list-item";

function EditableRow({ item, onSaved }: { item: PriceListItem; onSaved: (updated: PriceListItem) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.defaultPrice));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/price-list/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: item.version, name, defaultPrice: Number(price) }),
    });
    setSaving(false);
    if (res.ok) {
      const body = (await res.json()) as { data: PriceListItem };
      onSaved(body.data);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div
        className="flex items-center justify-between gap-3 py-2.5 last:border-0"
        style={{ borderBottom: "var(--rule)" }}
      >
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{item.name}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>₪{item.defaultPrice}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold hover:underline"
            style={{ color: "var(--accent)" }}
          >
            עריכה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-end gap-2 py-2 last:border-0"
      style={{ borderBottom: "var(--rule)" }}
    >
      <Field label="שם" htmlFor={`price-item-${item.id}-name`} className="flex-1 min-w-0">
        <Input id={`price-item-${item.id}-name`} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="מחיר" htmlFor={`price-item-${item.id}-price`} className="w-28">
        <Input
          id={`price-item-${item.id}-price`}
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </Field>
      <button
        type="button"
        disabled={saving || !name.trim() || !price}
        onClick={() => void save()}
        className="flex-shrink-0 whitespace-nowrap text-xs font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
        style={{ color: "var(--accent)", height: "var(--field-h)", display: "flex", alignItems: "center" }}
      >
        שמור
      </button>
    </div>
  );
}

export function PriceListSettings({ clinicId }: { clinicId: string }) {
  const [items, setItems] = useState<PriceListItem[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/price-list");
      if (res.ok) {
        const body = (await res.json()) as { data: { items: PriceListItem[] } };
        setItems(body.data.items);
      }
    })();
  }, []);

  async function addItem() {
    setCreating(true);
    const res = await fetch("/api/price-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, name: newName, defaultPrice: Number(newPrice) }),
    });
    setCreating(false);
    if (res.ok) {
      const body = (await res.json()) as { data: PriceListItem };
      setItems((current) => [...(current ?? []), body.data]);
      setNewName("");
      setNewPrice("");
    }
  }

  if (items === null) return <Skeleton className="h-32" />;

  return (
    <div>
      {items.map((item) => (
        <EditableRow
          key={item.id}
          item={item}
          onSaved={(updated) =>
            setItems((current) => (current ?? []).map((row) => (row.id === updated.id ? updated : row)))
          }
        />
      ))}
      <div className="flex items-end gap-2 pt-2">
        <Field label="פריט חדש" htmlFor="price-item-new-name" className="flex-1 min-w-0">
          <Input id="price-item-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </Field>
        <Field label="מחיר" htmlFor="price-item-new-price" className="w-28">
          <Input
            id="price-item-new-price"
            type="number"
            min="0"
            step="0.01"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
        </Field>
        <button
          type="button"
          disabled={creating || !newName.trim() || !newPrice}
          onClick={() => void addItem()}
          className="flex-shrink-0 whitespace-nowrap text-xs font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
          style={{ color: "var(--accent)", height: "var(--field-h)", display: "flex", alignItems: "center" }}
        >
          + הוסף פריט
        </button>
      </div>
    </div>
  );
}
