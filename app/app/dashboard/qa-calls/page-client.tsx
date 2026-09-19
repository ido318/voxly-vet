"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { SkeletonRow } from "@/components/dashboard/ui/skeleton";
import { Tabs } from "@/components/dashboard/ui/tabs";
import { Table } from "@/components/dashboard/ui/table";
import type { CallReview, CallReviewSeverityFilter } from "@/types/domain/call-review";

const SEVERITY_TONE: Record<string, "critical" | "pending" | "info" | "done"> = {
  critical: "critical",
  high: "critical",
  medium: "pending",
  low: "info",
  none: "done",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "קריטית",
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
  none: "ללא חריגה",
};

const FILTERS: { value: CallReviewSeverityFilter; label: string }[] = [
  { value: "all", label: "הכול" },
  { value: "critical", label: "קריטית" },
  { value: "high", label: "גבוהה" },
  { value: "medium", label: "בינונית" },
  { value: "low", label: "נמוכה" },
  { value: "none", label: "ללא חריגה" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function QaCallsPageClient() {
  const router = useRouter();
  const [items, setItems] = useState<CallReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<CallReviewSeverityFilter>("all");

  const fetchData = useCallback(async (sev: CallReviewSeverityFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider-admin/calls?severity=${sev}&page=1`);
      if (res.ok) {
        const d = (await res.json()) as { data: { items: CallReview[] } };
        setItems(d.data.items ?? []);
      } else {
        setError("שגיאה בטעינת השיחות. נסה לרענן את הדף.");
      }
    } catch {
      setError("שגיאה בטעינת השיחות. נסה לרענן את הדף.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(severity);
  }, [severity, fetchData]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 style={{ font: "var(--type-page-title)", color: "var(--text-primary)" }}>שיחות עם ניקוד QA</h1>
        <Tabs variant="pill" value={severity} onChange={setSeverity} items={FILTERS} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : error ? (
        <EmptyState title="שגיאה" subtitle={error} />
      ) : items.length === 0 ? (
        <EmptyState title="אין שיחות בטווח הזה" subtitle="שיחות עם ניקוד QA מ-30 הימים האחרונים יופיעו כאן." />
      ) : (
        <Table
          rows={items}
          rowKey={(item) => item.id}
          onRowClick={(item) => router.push(`/dashboard/qa-calls/${item.id}`)}
          columns={[
            {
              key: "caller",
              header: "מתקשר",
              render: (item) => (
                <span className="text-[13.5px]" style={{ color: "var(--text-primary)" }}>
                  {item.conversationId}
                  <span className="block text-[11.5px]" style={{ color: "var(--text-faint)" }}>{fmtDate(item.createdAt)}</span>
                </span>
              ),
            },
            {
              key: "score",
              header: "ציון כללי",
              render: (item) => (
                <span style={{ font: "var(--type-metric)", color: "var(--text-primary)" }}>
                  {item.overallScore ?? "—"}
                </span>
              ),
            },
            {
              key: "severity",
              header: "חומרה",
              render: (item) => (
                <Badge tone={SEVERITY_TONE[item.exceptionSeverity ?? "none"]}>
                  {SEVERITY_LABEL[item.exceptionSeverity ?? "none"]}
                </Badge>
              ),
            },
            {
              key: "summary",
              header: "סיכום",
              className: "max-w-[280px]",
              render: (item) => (
                <span className="truncate block text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                  {item.reviewerSummary ?? "—"}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
