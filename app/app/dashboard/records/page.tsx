import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { Badge } from "@/components/dashboard/ui/badge";
import { Card } from "@/components/dashboard/ui/card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { RecordsIcon } from "@/components/dashboard/icons";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Visit } from "@/types/domain/visit";

function statusHe(status: Visit["status"]): string {
  if (status === "completed") return "הושלם";
  if (status === "cancelled") return "בוטל";
  return "בטיפול";
}

function statusTone(status: Visit["status"]): "done" | "critical" | "pending" {
  if (status === "completed") return "done";
  if (status === "cancelled") return "critical";
  return "pending";
}

export default async function RecordsPage() {
  const data = await dashboardApiFetch<{ items: Visit[] }>("/api/visits?limit=50");
  const visits = data?.items ?? [];
  const completed = visits.filter((visit) => visit.status === "completed").length;
  const withAi = visits.filter((visit) => Boolean(visit.aiVisitSummary)).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">תיקים רפואיים</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">ביקורים, סיכומי AI, הערות, תרופות וחיסונים.</p>
        </div>
        <Link
          href="/dashboard/visits/new"
          className="rounded-[var(--radius-2)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 text-[13px] font-medium text-[var(--text-on-accent)] transition"
        >
          ביקור חדש
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-xs text-[var(--text-muted)]">ביקורים</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{visits.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--text-muted)]">הושלמו</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{completed}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--text-muted)]">עם סיכום AI</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{withAi}</p>
        </Card>
      </div>

      {visits.length === 0 ? (
        <EmptyState
          icon={<RecordsIcon size={36} />}
          title="אין ביקורים"
          subtitle="ביקורים רפואיים, סיכומי AI, תרופות וחיסונים יופיעו כאן"
        />
      ) : (
        <Card noPad>
          <ul className="divide-y divide-[var(--border-row)]">
            {visits.map((visit) => (
              <li key={visit.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/visits/${visit.id}`}
                      className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent-hover)]"
                    >
                      {formatIsraelDateTime(visit.startedAt)}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {visit.chiefComplaint ?? "ללא תלונה ראשית"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visit.manualVisitSummary && <Badge tone="neutral">סיכום ידני</Badge>}
                      {visit.aiVisitSummary && <Badge tone="info">סיכום AI</Badge>}
                      <Link className="text-xs font-semibold text-[var(--accent-hover)]" href={`/dashboard/pets/${visit.petId}`}>
                        פרופיל חיה
                      </Link>
                    </div>
                  </div>
                  <Badge tone={statusTone(visit.status)}>{statusHe(visit.status)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
