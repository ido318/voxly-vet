"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The navigation rail: dark graphite, sitting at the inline start (the right,
 * in RTL). Text-only by design — the system carries no icons in the sidebar,
 * so the labels do the work and a teal marker shows the active row.
 */

interface NavItem {
  href: string;
  label: string;
  countKey?: "escalations" | "tasks";
  critical?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function getNavGroups(isProviderAdmin: boolean): NavGroup[] {
  return [
    {
      label: "מרפאה",
      items: [
        { href: "/dashboard", label: "היום" },
        { href: "/dashboard/calendar", label: "לוח שנה" },
        { href: "/dashboard/clients", label: "לקוחות ומטופלים" },
        { href: "/dashboard/pets", label: "חיות מחמד" },
        { href: "/dashboard/waitlist", label: "המתנה" },
      ],
    },
    {
      label: "תומר",
      items: [
        { href: "/dashboard/calls", label: "שיחות" },
        { href: "/dashboard/escalations", label: "תשומת לב", countKey: "escalations", critical: true },
        ...(isProviderAdmin
          ? [
              { href: "/dashboard/qa-calls", label: "שיחות QA" },
              { href: "/dashboard/improvements", label: "הצעות תיקון" },
            ]
          : []),
      ],
    },
    {
      label: "רפואה",
      items: [
        { href: "/dashboard/visits", label: "ביקורים" },
        { href: "/dashboard/records", label: "תיקים רפואיים" },
        { href: "/dashboard/tasks", label: "משימות", countKey: "tasks" },
        { href: "/dashboard/lab", label: "מעבדה" },
      ],
    },
    {
      label: "ניהול",
      items: [
        { href: "/dashboard/billing", label: "חיובים" },
        { href: "/dashboard/inventory", label: "מלאי" },
        { href: "/dashboard/settings", label: "הגדרות" },
      ],
    },
  ];
}

interface SidebarProps {
  openEscalations?: number;
  openTasks?: number;
  userName?: string;
  userRole?: string;
  agentStatus?: string;
  agentDetail?: string;
  isProviderAdmin?: boolean;
}

function NavLink({ item, count }: { item: NavItem; count?: number }) {
  const pathname = usePathname();
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className="flex items-center h-[31px] px-3 rounded-[var(--radius-2)] text-[13.5px] no-underline"
        style={{
          fontWeight: active ? "var(--w-semibold)" : "var(--w-book)",
          color: active ? "var(--rail-text-strong)" : "var(--rail-text)",
          background: active ? "var(--rail-bg-active)" : "transparent",
          boxShadow: active ? "inset -2px 0 0 var(--rail-marker)" : "none",
          transition: "var(--transition-color)",
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = "var(--rail-bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        <span className="flex-1">{item.label}</span>
        {count != null && count > 0 && (
          <span
            className="gv-data text-[11.5px]"
            style={{
              fontWeight: "var(--w-semibold)",
              color: item.critical ? "var(--rail-critical-text)" : "var(--rail-text-muted)",
            }}
          >
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}

export function Sidebar({
  openEscalations = 0,
  openTasks = 0,
  userName = "ד״ר דנה כהן",
  userRole = "וטרינרית ראשית",
  agentStatus = "מענה קולי פעיל",
  agentDetail,
  isProviderAdmin = false,
}: SidebarProps) {
  const counts = { escalations: openEscalations, tasks: openTasks };
  const navGroups = getNavGroups(isProviderAdmin);

  const initials = userName
    .replace("ד״ר ", "")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 px-2"
      style={{
        width: "var(--sidebar-w)",
        background: "var(--rail-bg)",
        color: "var(--rail-text)",
      }}
    >
      {/* Brand — the monochrome mark beside the text lockup */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ height: "var(--header-h)" }}
      >
        {/* Masked rather than <img>, so the currentColor mark takes the rail's
            text colour instead of rendering as flat black. */}
        <span
          aria-hidden="true"
          className="block h-5 w-5 flex-shrink-0"
          style={{
            background: "var(--rail-text-strong)",
            WebkitMaskImage: "url(/logo-mark.svg)",
            maskImage: "url(/logo-mark.svg)",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            maskSize: "contain",
          }}
        />
        <span
          className="text-[14px]"
          style={{
            color: "var(--rail-text-strong)",
            fontWeight: "var(--w-semibold)",
            letterSpacing: "-.02em",
          }}
        >
          Demo Vet Clinic
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div
              className="pt-4 pb-1 px-3 text-[10.5px]"
              style={{
                fontWeight: "var(--w-semibold)",
                letterSpacing: ".06em",
                color: "var(--rail-text-muted)",
              }}
            >
              {group.label}
            </div>
            <ul>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  count={item.countKey ? counts[item.countKey] : undefined}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Tomer — named and credited, never anthropomorphised beyond that */}
      <div
        className="mt-auto mb-2 p-3 flex-shrink-0"
        style={{
          borderRadius: "var(--radius-3)",
          background: "rgba(255,255,255,.05)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--teal-600)" }}
          />
          <span
            className="text-[12.5px]"
            style={{ color: "var(--rail-text-strong)", fontWeight: "var(--w-semibold)" }}
          >
            תומר
          </span>
          <span className="text-[11.5px]" style={{ color: "var(--rail-text-muted)" }}>
            · {agentStatus}
          </span>
        </div>
        {agentDetail && (
          <p className="mt-[3px] text-[11.5px]" style={{ color: "var(--rail-text-muted)" }}>
            {agentDetail}
          </p>
        )}
      </div>

      {/* User */}
      <div
        className="flex items-center gap-2 p-3 flex-shrink-0"
        style={{ borderTop: "1px solid var(--rail-separator)" }}
      >
        <span
          className="w-7 h-7 flex-shrink-0 rounded-full grid place-items-center text-[11px]"
          style={{
            background: "rgba(255,255,255,.09)",
            color: "var(--rail-text-strong)",
            fontWeight: "var(--w-semibold)",
          }}
        >
          {initials}
        </span>
        <span className="min-w-0">
          <span
            className="block text-[12.5px] truncate"
            style={{ color: "var(--rail-text-strong)", fontWeight: "var(--w-semibold)" }}
          >
            {userName}
          </span>
          <span className="block text-[11px]" style={{ color: "var(--rail-text-muted)" }}>
            {userRole}
          </span>
        </span>
      </div>
    </aside>
  );
}
