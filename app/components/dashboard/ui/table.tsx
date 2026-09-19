import React from "react";
import { Card } from "@/components/dashboard/ui/card";

/**
 * One table shell for every list screen. Wraps the existing Card so callers
 * don't repeat that, and standardises the clickable-row pattern on a plain
 * onClick — never a Link wrapped around a colSpan cell.
 */

interface TableColumn<T> {
  key: string;
  header: string;
  align?: "start" | "end";
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function Table<T>({ columns, rows, rowKey, onRowClick, className = "" }: TableProps<T>) {
  return (
    <Card noPad className={["overflow-x-auto", className].join(" ")}>
      <table className="w-full" style={{ borderCollapse: "collapse", minWidth: "560px" }}>
        <thead>
          <tr style={{ height: "var(--thead-h)", borderBottom: "var(--rule)" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  "px-4 font-semibold uppercase whitespace-nowrap",
                  col.align === "end" ? "text-end" : "text-start",
                  col.className ?? "",
                ].join(" ")}
                style={{ fontSize: "10.5px", letterSpacing: "var(--track-nano)", color: "var(--text-faint)" }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(row);
                }
              } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={onRowClick ? "cursor-pointer hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]" : ""}
              style={{ borderBottom: "var(--rule-row)", transition: "var(--transition-color)" }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={["px-4 py-3", col.align === "end" ? "text-end" : "text-start", col.className ?? ""].join(" ")}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
