"use client";
import React from "react";
import Link from "next/link";
import { AnimalAvatar, PersonAvatar } from "@/components/dashboard/ui/avatar";
import { Badge } from "@/components/dashboard/ui/badge";
import { Drawer } from "@/components/dashboard/ui/drawer";
import { ProblemListEntryRow } from "@/components/dashboard/medical-record/active-problems";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Customer } from "@/types/domain/customer";
import type { MedicalRecord } from "@/types/domain/medical-record";
import type { Pet } from "@/types/domain/pet";
import type { Prescription } from "@/types/domain/prescription";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Visit } from "@/types/domain/visit";

function initials(name: string): string {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
}

export function PatientContextDrawer({
  open,
  onClose,
  pet,
  owner,
  visits,
  vaccinations,
  prescriptions,
  medicalRecord,
}: {
  open: boolean;
  onClose: () => void;
  pet: Pet;
  owner: Customer | null;
  visits: Visit[];
  vaccinations: Vaccination[];
  prescriptions: Prescription[];
  medicalRecord: MedicalRecord | null;
}) {
  const activePrescriptions = prescriptions.filter((prescription) => prescription.status === "active");
  const alerts = [
    pet.allergies ? `אלרגיה: ${pet.allergies}` : null,
    pet.chronicConditions ? `כרוני: ${pet.chronicConditions}` : null,
    ...(medicalRecord?.alerts ?? []).map((alert) => String(alert)),
  ].filter(Boolean);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={420}
      title={
        <div className="flex items-center gap-3">
          <AnimalAvatar species={pet.species} size={42} />
          <div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">{pet.name}</p>
            <p className="text-xs font-normal text-[var(--text-muted)]">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6 px-5 py-4">
        {owner && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">בעלים</p>
            <Link
              href={`/dashboard/clients?customerId=${owner.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-2)] border border-[var(--border-hairline)] px-3 py-2 transition-colors hover:bg-[var(--surface-hover)]"
            >
              <PersonAvatar initials={initials(owner.fullName)} size={34} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{owner.fullName}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{owner.phone ?? owner.email ?? "ללא פרטי קשר"}</p>
              </div>
            </Link>
          </section>
        )}

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">אזהרות</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alerts.length === 0 ? (
              <span className="text-sm text-[var(--text-faint)]">אין אזהרות פעילות.</span>
            ) : (
              alerts.map((alert, index) => <Badge key={index} tone="critical">{alert}</Badge>)
            )}
          </div>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">סיכום רפואי</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">
            {medicalRecord?.summary || "אין עדיין סיכום רפואי קבוע."}
          </p>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">בעיות פעילות</p>
          <div className="mt-2 space-y-1">
            {(medicalRecord?.activeProblemList ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">אין בעיות פעילות רשומות.</p>
            ) : (
              medicalRecord!.activeProblemList.map((problem, index) => (
                <ProblemListEntryRow key={index} problem={problem} />
              ))
            )}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">ביקורים אחרונים</p>
            <Link href={`/dashboard/visits/new?petId=${pet.id}`} className="text-xs font-semibold text-[var(--accent)] hover:underline">
              ביקור חדש
            </Link>
          </div>
          {visits.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)]">אין ביקורים רפואיים.</p>
          ) : (
            <div className="divide-y divide-[var(--border-row)] rounded-[var(--radius-2)] border border-[var(--border-hairline)]">
              {visits.slice(0, 5).map((visit) => (
                <Link
                  key={visit.id}
                  href={`/dashboard/visits/${visit.id}`}
                  className="block px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{formatIsraelDateTime(visit.startedAt)}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{visit.chiefComplaint ?? "ללא תלונה ראשית"}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">מניעה ותרופות</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--text-primary)]">
            <div className="rounded-[var(--radius-2)] bg-[var(--surface-sunken)] p-3">
              <p className="font-semibold">{vaccinations.length}</p>
              <p className="text-[var(--text-muted)]">חיסונים</p>
            </div>
            <div className="rounded-[var(--radius-2)] bg-[var(--surface-sunken)] p-3">
              <p className="font-semibold">{activePrescriptions.length}</p>
              <p className="text-[var(--text-muted)]">מרשמים פעילים</p>
            </div>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
