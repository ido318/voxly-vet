"use client";
import React from "react";

/**
 * One selector for every filter row and content-tab strip in the app.
 * "pill" is the bordered segmented control used for status/category filters;
 * "underline" is the bottom-border strip used for content tabs (a record's
 * sections, a call's summary/transcript/recording).
 */

type TabsVariant = "pill" | "underline";
type TabsSize = "sm" | "md";

interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  /** Pill only: lets the group wrap onto multiple lines instead of clipping
   * overflow — for filter rows with enough options that one row won't fit. */
  wrap?: boolean;
  className?: string;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = "underline",
  size = "md",
  wrap = false,
  className = "",
}: TabsProps<T>) {
  if (variant === "pill") {
    const pillHeight = size === "sm" ? "var(--control-h-sm)" : "var(--control-h)";
    const pillTextClass = size === "sm" ? "text-[12px]" : "text-[13px]";

    if (wrap) {
      return (
        <div role="group" className={["flex flex-wrap gap-1.5", className].join(" ")}>
          {items.map((item) => {
            const active = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(item.value)}
                className={["px-3 whitespace-nowrap", pillTextClass].join(" ")}
                style={{
                  height: pillHeight,
                  borderRadius: "var(--radius-2)",
                  border: "var(--border-w) solid var(--border-field)",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
                  fontWeight: active ? "var(--w-semibold)" : "var(--w-regular)",
                  transition: "var(--transition-color)",
                }}
              >
                {item.label}
                {item.count != null && (
                  <span className="gv-data ms-1.5" style={{ opacity: 0.75 }}>{item.count}</span>
                )}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div
        role="group"
        className={["inline-flex overflow-hidden flex-shrink-0", className].join(" ")}
        style={{ borderRadius: "var(--radius-2)", border: "var(--border-w) solid var(--border-field)" }}
      >
        {items.map((item, i) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item.value)}
              className={["px-3 whitespace-nowrap", pillTextClass].join(" ")}
              style={{
                height: pillHeight,
                borderInlineStart: i > 0 ? "var(--border-w) solid var(--border-field)" : "none",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
                fontWeight: active ? "var(--w-semibold)" : "var(--w-regular)",
                transition: "var(--transition-color)",
              }}
            >
              {item.label}
              {item.count != null && (
                <span className="gv-data ms-1.5" style={{ opacity: 0.75 }}>{item.count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" className={["flex items-center gap-5", className].join(" ")} style={{ borderBottom: "var(--rule)" }}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={size === "sm" ? "py-2" : "py-2.5"}
            style={{
              fontSize: "13px",
              fontWeight: active ? "var(--w-semibold)" : "var(--w-regular)",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "var(--transition-color)",
            }}
          >
            {item.label}
            {item.count != null && (
              <span className="gv-data ms-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
