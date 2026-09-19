"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { ClockIcon, PhoneIcon } from "@/components/dashboard/icons";
import type { WaitlistEntry } from "@/types/domain/waitlist";
import { Alert } from "@/components/dashboard/ui/alert";
import { Btn } from "@/components/dashboard/ui/btn";

const TZ = "Asia/Jerusalem";
function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(iso));
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function WaitlistRow({ entry }: { entry: WaitlistEntry }) {
  const range = entry.preferredStart
    ? entry.preferredEnd && entry.preferredEnd !== entry.preferredStart
      ? `${fmtDate(entry.preferredStart)} – ${fmtDate(entry.preferredEnd)}`
      : fmtDate(entry.preferredStart)
    : null;

  return (
    <div className="flex items-center gap-3 px-[18px] py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{entry.customerName ?? "לקוח לא ידוע"}</p>
          {entry.petName && <span className="text-xs text-[var(--text-muted)]">· {entry.petName}</span>}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {entry.customerPhone && (
            <a href={`tel:${entry.customerPhone}`} className="flex items-center gap-1 hover:text-[var(--accent)]">
              <PhoneIcon size={12} /> {entry.customerPhone}
            </a>
          )}
          {range && (
            <span className="flex items-center gap-1">
              <ClockIcon size={12} /> {range}
            </span>
          )}
        </div>
        {entry.notes && <p className="mt-1 text-xs text-[var(--text-faint)]">{entry.notes}</p>}
      </div>
      <TypePill type={entry.visitType} />
      <span className="flex-shrink-0 text-[11px] text-[var(--text-faint)]">{fmtDateTime(entry.createdAt)}</span>
    </div>
  );
}

export default function WaitlistPage() {
  const [items, setItems] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Was an inline effect with `if (res.ok)` and no else and no catch: a failed
  // load rendered "אין ממתינים כרגע" — the queue looks empty when it is not —
  // and a network throw left an unhandled rejection with loading stuck true,
  // i.e. a skeleton forever. Extracted so the retry button has something to
  // call. Mirrors the pattern on the today screen.
  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/waitlist");
      if (!res.ok) {
        setLoadError("טעינת רשימת ההמתנה נכשלה.");
        return;
      }
      const d = await res.json() as { data: { items: WaitlistEntry[] } };
      setItems(d.data.items ?? []);
    } catch {
      setLoadError("טעינת רשימת ההמתנה נכשלה. בדוק/י את החיבור ונסה/י שוב.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">המתנה</h1>
          {!loadError && (
            <span className="text-sm text-[var(--text-muted)]">{items.length} רשומים</span>
          )}
        </div>
      </div>

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
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : items.length === 0 && !loadError ? (
        <EmptyState
          icon={<ClockIcon size={32} />}
          title="אין ממתינים כרגע"
          subtitle="לקוחות שתומר לא מצא עבורם תור פנוי יופיעו כאן"
        />
      ) : (
        <Card noPad>
          <div className="divide-y divide-[var(--border-row)]">
            {items.map((entry) => <WaitlistRow key={entry.id} entry={entry} />)}
          </div>
        </Card>
      )}
    </div>
  );
}
