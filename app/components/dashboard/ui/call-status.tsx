import React from "react";
import { Badge } from "@/components/dashboard/ui/badge";

export type CallStatus =
  | "done" | "missed" | "escalated" | "active"
  | "completed" | "failed" | "in_progress"
  | "ringing" | "queued" | "busy" | "no_answer" | "canceled";

const CALL_STATUS: Record<CallStatus, { label: string; tone: "done" | "pending" | "critical" | "neutral" }> = {
  ringing:     { label: "מצלצל",   tone: "pending" },
  queued:      { label: "בתור",    tone: "neutral" },
  in_progress: { label: "בשיחה",   tone: "pending" },
  active:      { label: "בשיחה",   tone: "pending" },
  completed:   { label: "הושלמה",  tone: "neutral" },
  done:        { label: "הושלמה",  tone: "neutral" },
  failed:      { label: "נכשלה",   tone: "neutral" },
  missed:      { label: "אין מענה", tone: "neutral" },
  busy:        { label: "תפוס",    tone: "neutral" },
  no_answer:   { label: "אין מענה", tone: "neutral" },
  canceled:    { label: "בוטלה",   tone: "neutral" },
  escalated:   { label: "הוסלמה",  tone: "critical" },
};

interface CallStatusBadgeProps {
  status: string;
  plain?: boolean;
  className?: string;
}

export function CallStatusBadge({ status, plain, className = "" }: CallStatusBadgeProps) {
  const s = CALL_STATUS[status as CallStatus] ?? CALL_STATUS.failed;
  // Neutral outcomes read as plain text; only a live or escalated call gets a chip.
  const isPlain = plain ?? s.tone === "neutral";
  return (
    <Badge tone={s.tone} plain={isPlain} className={className}>
      {s.label}
    </Badge>
  );
}

export function CallDirection({ direction = "inbound" }: { direction?: string }) {
  return (
    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
      {direction === "outbound" ? "יוצאת" : "נכנסת"}
    </span>
  );
}

/** The call's category — operation (a booking/cancellation) vs. plain information. */
export function CallCategoryBadge({ category }: { category: string | null | undefined }) {
  if (!category) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  return (
    <Badge tone={category === "operation" ? "info" : "neutral"}>
      {category === "operation" ? "פעולה" : "מידע"}
    </Badge>
  );
}

export { CALL_STATUS };
