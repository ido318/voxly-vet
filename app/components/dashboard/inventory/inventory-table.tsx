"use client";

import { Badge } from "@/components/dashboard/ui/badge";
import { Table } from "@/components/dashboard/ui/table";
import type { InventoryItem } from "@/types/domain/inventory";

export function InventoryTable({ items }: { items: InventoryItem[] }) {
  return (
    <Table
      rows={items}
      rowKey={(item) => item.id}
      columns={[
        {
          key: "name",
          header: "שם",
          render: (item) => (
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{item.name}</span>
          ),
        },
        {
          key: "stock",
          header: "מלאי",
          render: (item) => (
            <span style={{ color: "var(--text-secondary)" }}>
              {item.quantityOnHand} {item.unit}
            </span>
          ),
        },
        {
          key: "status",
          header: "סטטוס",
          render: (item) =>
            item.quantityOnHand <= item.reorderLevel ? (
              <Badge tone="pending">מלאי נמוך</Badge>
            ) : (
              <Badge tone="done">תקין</Badge>
            ),
        },
      ]}
    />
  );
}
