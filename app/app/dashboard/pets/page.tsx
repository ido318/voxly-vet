import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { Badge } from "@/components/dashboard/ui/badge";
import { Card } from "@/components/dashboard/ui/card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { PetsIcon } from "@/components/dashboard/icons";
import type { Pet } from "@/types/domain/pet";

function petMeta(pet: Pet): string {
  return [pet.species, pet.breed, pet.sex].filter(Boolean).join(" · ") || "ללא פרטים";
}

export default async function PetsPage() {
  const data = await dashboardApiFetch<{ items: Pet[] }>("/api/pets");
  const pets = data?.items ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">חיות מחמד</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">פרופילים, תרופות קבועות, חיסונים וביקורים.</p>
        </div>
        <Badge tone="neutral">{pets.length} חיות</Badge>
      </div>

      {pets.length === 0 ? (
        <EmptyState
          icon={<PetsIcon size={36} />}
          title="אין חיות רשומות"
          subtitle="כשיתווספו לקוחות וחיות, הן יופיעו כאן"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {pets.map((pet) => (
            <Link key={pet.id} href={`/dashboard/pets/${pet.id}`} className="block">
              <Card className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-[var(--text-primary)]">{pet.name}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{petMeta(pet)}</p>
                  </div>
                  <Badge tone={pet.status === "active" ? "done" : "neutral"}>
                    {pet.status === "active" ? "פעיל" : "לא פעיל"}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[var(--text-faint)]">משקל</p>
                    <p className="font-semibold text-[var(--text-primary)]">{pet.weight != null ? `${pet.weight} ק״ג` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-faint)]">שבב</p>
                    <p className="font-semibold text-[var(--text-primary)]">{pet.chipNumber ?? "—"}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div>
                    <p className="font-semibold text-[var(--text-secondary)]">תרופות קבועות</p>
                    <p className="line-clamp-2 text-[var(--text-muted)]">{pet.currentMedications || "לא רשום"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-secondary)]">רגישויות / מצבים כרוניים</p>
                    <p className="line-clamp-2 text-[var(--text-muted)]">
                      {[pet.allergies, pet.chronicConditions].filter(Boolean).join(" · ") || "לא רשום"}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
