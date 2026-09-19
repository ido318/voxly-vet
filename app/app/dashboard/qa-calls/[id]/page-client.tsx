"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, SectionHeading } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import type { CallReview } from "@/types/domain/call-review";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

type Detail = { review: CallReview; linkedSuggestion: PromptSuggestion | null };

const SCORE_LABELS: { key: keyof CallReview; label: string }[] = [
  { key: "empathyScore", label: "אמפתיה" },
  { key: "naturalnessScore", label: "טבעיות" },
  { key: "accuracyScore", label: "דיוק" },
  { key: "protocolScore", label: "נוהל" },
  { key: "safetyScore", label: "בטיחות" },
  { key: "resolutionScore", label: "פתרון" },
];

export function QaCallDetailPageClient() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const res = await fetch(`/api/provider-admin/calls/${params.id}`);
        if (res.status === 404) {
          setNotFound(true);
        } else if (res.ok) {
          const d = (await res.json()) as { data: Detail };
          setDetail(d.data);
        } else {
          setError("שגיאה בטעינת השיחה. נסה לרענן את הדף.");
        }
      } catch {
        setError("שגיאה בטעינת השיחה. נסה לרענן את הדף.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) return <div className="p-6" />;
  if (error) {
    return (
      <div className="p-6">
        <EmptyState title="שגיאה" subtitle={error} />
      </div>
    );
  }
  if (notFound || !detail) {
    return (
      <div className="p-6">
        <EmptyState title="השיחה לא נמצאה" />
      </div>
    );
  }

  const { review, linkedSuggestion } = detail;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div>
        <h1 style={{ font: "var(--type-page-title)", color: "var(--text-primary)" }}>{review.conversationId}</h1>
        <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          {new Date(review.createdAt).toLocaleString("he-IL")} · {review.callDurationSecs ?? "—"} שניות
        </p>
      </div>

      <Card>
        <SectionHeading title="ציוני QA" />
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div>
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>ציון כללי</p>
            <p style={{ font: "var(--type-metric)", color: "var(--text-primary)" }}>{review.overallScore ?? "—"}</p>
          </div>
          {SCORE_LABELS.map(({ key, label }) => (
            <div key={String(key)}>
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>{label}</p>
              <p style={{ font: "var(--type-row)", color: "var(--text-primary)" }}>{String(review[key] ?? "—")}</p>
            </div>
          ))}
        </div>
        {review.exceptionSeverity && (
          <div className="mt-3">
            <Badge tone={review.isException ? "critical" : "done"}>
              {review.isException ? `חריגה — חומרה ${review.exceptionSeverity}` : "ללא חריגה"}
            </Badge>
          </div>
        )}
      </Card>

      {review.reviewerSummary && (
        <Card>
          <SectionHeading title="סיכום הביקורת" />
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{review.reviewerSummary}</p>
        </Card>
      )}

      {review.problems.length > 0 && (
        <Card>
          <SectionHeading title="בעיות שזוהו" count={review.problems.length} />
          <div className="space-y-3 mt-3">
            {review.problems.map((p, i) => (
              <div key={i} style={{ borderBottom: i < review.problems.length - 1 ? "1px solid var(--border-row)" : "none", paddingBottom: 10 }}>
                <p className="text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>{p.problem}</p>
                {p.root_cause && <p className="text-[12.5px] mt-1" style={{ color: "var(--text-muted)" }}>סיבה: {p.root_cause}</p>}
                {p.proposed_change && <p className="text-[12.5px] mt-1" style={{ color: "var(--text-secondary)" }}>הצעה: {p.proposed_change}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {linkedSuggestion && (
        <Card>
          <SectionHeading title="הצעת תיקון מקושרת" />
          <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>{linkedSuggestion.patternSummary}</p>
          <Link href="/dashboard/improvements" className="text-[12.5px] mt-2 inline-block" style={{ color: "var(--text-link)" }}>
            לתיבת ההצעות →
          </Link>
        </Card>
      )}
    </div>
  );
}
