import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Btn } from "@/components/dashboard/ui/btn";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Visit, VisitStatus } from "@/types/domain/visit";

type SearchParams = Promise<{ petId?: string; clinicId?: string }>;

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.clinicId) query.set("clinicId", params.clinicId);
  if (params.petId) query.set("petId", params.petId);
  const endpoint = `/api/visits${query.toString() ? `?${query.toString()}` : ""}`;
  const response = await dashboardApiFetch<{ items: Visit[] }>(endpoint);
  const items = response?.items ?? [];

  const newHref = params.petId
    ? `/dashboard/visits/new?petId=${encodeURIComponent(params.petId)}`
    : "/dashboard/visits/new";

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-semibold text-[var(--text-primary)]">ביקורים</h2>
        <Btn href={newHref}>ביקור חדש</Btn>
      </div>

      <Card noPad>
        {items.length === 0 ? (
          <EmptyState title="לא נמצאו ביקורים." className="px-4" />
        ) : (
          <ul className="divide-y divide-[var(--border-row)]">
            {items.map((visit) => (
              <li key={visit.id} className="p-4">
                <Link
                  href={`/dashboard/visits/${visit.id}`}
                  className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]"
                >
                  {formatIsraelDateTime(visit.startedAt)} · {VISIT_STATUS_LABELS[visit.status]}
                </Link>
                <p className="text-sm text-[var(--text-secondary)]">
                  {visit.chiefComplaint ?? "לא נרשמה סיבת ביקור"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
