"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { Modal } from "@/components/dashboard/ui/modal";
import { Field, Textarea } from "@/components/dashboard/ui/field";
import { Tabs } from "@/components/dashboard/ui/tabs";
import { UrgencyMeter } from "@/components/dashboard/ui/urgency-meter";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { useToast } from "@/components/dashboard/ui/toast";
import { ClockIcon, PhoneIcon } from "@/components/dashboard/icons";
import type { Escalation, EscalationContext } from "@/types/domain/escalation";
import { formatEscalationReason, parseEscalationReason } from "@/lib/triage-labels";
import { formatIsraeliPhoneLocal } from "@tomer/shared";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function ResolveModal({
  escalation,
  onResolved,
  onClose,
}: {
  escalation: Escalation;
  onResolved: () => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleResolve() {
    setLoading(true);
    try {
      const res = await fetch(`/api/escalations/${escalation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast("האסקלציה סומנה כטופלה", "success");
      onResolved();
    } catch {
      toast("שגיאה בעדכון האסקלציה", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="סגירת אסקלציה" subtitle={formatEscalationReason(escalation.reason)} maxWidth={420}>
      <Field label="הערות (אופציונלי)" htmlFor="resolve-notes">
        <Textarea
          id="resolve-notes"
          rows={3}
          placeholder="מה בוצע? הערות לתיק..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
        <Btn variant="primary" size="sm" loading={loading} onClick={handleResolve}>
          סמן כטופלה
        </Btn>
      </div>
    </Modal>
  );
}

function EscalationCard({
  escalation,
  onResolve,
}: {
  escalation: Escalation;
  onResolve: (e: Escalation) => void;
}) {
  const isResolved = Boolean(escalation.resolvedAt);

  return (
    <Card className={`transition-opacity ${isResolved ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: urgency + details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <UrgencyMeter value={escalation.urgency} />
            {escalation.afterHours && (
              <Badge tone="pending" dot>אחרי שעות פעילות</Badge>
            )}
            {isResolved && <Badge tone="done">טופלה</Badge>}
          </div>

          {/* Who is calling. Until the identity columns existed this card showed
              a reason string and nothing else — no name, no number, no way to
              reach whoever raised it. */}
          {(escalation.customerName || escalation.callerPhone) && (
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {escalation.customerName && (
                <a
                  href={`/dashboard/clients?customerId=${escalation.customerId}`}
                  className="text-[14px] font-semibold hover:underline"
                  style={{ color: "var(--text-primary)" }}
                >
                  {escalation.customerName}
                </a>
              )}
              {escalation.petName && (
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  · {escalation.petName}
                </span>
              )}
              {escalation.callerPhone && (
                <a
                  href={`tel:${escalation.callerPhone}`}
                  className="text-[12px] hover:underline"
                  style={{ color: "var(--brand-600)" }}
                  dir="ltr"
                >
                  {formatIsraeliPhoneLocal(escalation.callerPhone)}
                </a>
              )}
            </div>
          )}

          <EscalationReason reason={escalation.reason} context={escalation.context} />

          <div className="mt-2 flex flex-wrap gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1">
              <ClockIcon size={11} />
              {formatDate(escalation.createdAt)}
            </span>
            {escalation.elevenLabsConversationId && (
              <a
                href={`/dashboard/calls?conversationId=${escalation.elevenLabsConversationId}`}
                className="flex items-center gap-1 hover:underline"
                style={{ color: "var(--brand-600)" }}
              >
                <PhoneIcon size={11} />
                האזן לשיחה
              </a>
            )}
          </div>

          {isResolved && escalation.notes && (
            <p
              className="mt-2 text-xs px-2 py-1"
              style={{ color: "var(--text-secondary)", borderRadius: "var(--radius-1)", background: "var(--surface-sunken)" }}
            >
              {escalation.notes}
            </p>
          )}
        </div>

        {/* Right: action */}
        {!isResolved && (
          <Btn variant="soft" size="sm" className="flex-shrink-0" onClick={() => onResolve(escalation)}>
            טפל
          </Btn>
        )}
      </div>
    </Card>
  );
}

type FilterStatus = "open" | "resolved" | "all";

/**
 * The agent stores the reason as one machine-readable string. Rendered as its
 * parts, the decision leads, the matched red flags read as chips, and what the
 * caller actually said sits underneath in their own words.
 */
function EscalationReason({
  reason,
  context,
}: {
  reason: string;
  context: EscalationContext;
}) {
  const { decision, flags, quote, raw } = parseEscalationReason(reason);
  // context.symptoms_he is the caller's full description. The quote embedded in
  // `reason` was cut at 120 characters, so prefer the column when it is there.
  const spoken = context.symptoms_he ?? quote;

  if (!decision) {
    return (
      <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{raw}</p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
          {decision}
        </span>
        {flags.map((flag) => (
          <Badge key={flag} tone="critical">{flag}</Badge>
        ))}
      </div>
      {spoken && (
        <p className="text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          ״{spoken}״
        </p>
      )}
    </div>
  );
}

export default function EscalationsPage() {
  const [items, setItems] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("open");
  const [resolveTarget, setResolveTarget] = useState<Escalation | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/escalations${params}`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Escalation[] } };
        setItems(d.data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [fetchData]);

  const openCount = items.filter(e => !e.resolvedAt).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>אסקלציות</h1>
          {openCount > 0 && (
            <span
              className="gv-data text-[13px]"
              style={{ color: "var(--status-critical-text)", fontWeight: "var(--w-semibold)" }}
            >
              {openCount}
            </span>
          )}
        </div>

        <Tabs
          variant="pill"
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { value: "open", label: "פתוחות" },
            { value: "resolved", label: "טופלו" },
            { value: "all", label: "הכול" },
          ]}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === "open" ? "אין אסקלציות פתוחות" : "אין אסקלציות"}
          subtitle={filter === "open" ? "כשתומר יסמן מקרה כדחוף — הוא יופיע כאן" : ""}
        />
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <EscalationCard key={e.id} escalation={e} onResolve={setResolveTarget} />
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {resolveTarget && (
        <ResolveModal
          escalation={resolveTarget}
          onResolved={() => {
            setResolveTarget(null);
            void fetchData();
          }}
          onClose={() => setResolveTarget(null)}
        />
      )}
    </div>
  );
}
