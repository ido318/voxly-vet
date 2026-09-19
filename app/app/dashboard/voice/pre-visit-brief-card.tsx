import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { VoiceCall } from "@/types/domain/voice-call";

export function PreVisitBriefCard({ calls }: { calls: VoiceCall[] }) {
  if (calls.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-[var(--ink)]">Pre-visit brief</h3>
        <Badge color="brand">שיחות אחרונות</Badge>
      </div>
      <div className="mt-3 space-y-3">
        {calls.map((call) => (
          <div key={call.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-[var(--ink)]">{call.fromNumber}</p>
              <p className="text-xs text-[var(--muted)]">{formatIsraelDateTime(call.startedAt)}</p>
            </div>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[var(--ink-2)]">
              {call.aiSummary ?? "אין סיכום AI לשיחה הזו."}
            </p>
            <Link
              href={`/dashboard/voice/${call.id}`}
              className="mt-2 inline-block text-xs font-semibold text-[var(--brand-600)] hover:underline"
            >
              פתח שיחה
            </Link>
          </div>
        ))}
      </div>
    </Card>
  );
}
