import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, type Result } from "@/lib/errors/app-error";
import { EscalationRepository } from "@/lib/repositories/escalation.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Escalation } from "@/types/domain/escalation";

export class EscalationService {
  constructor(
    client: SupabaseClient,
    private readonly repo = new EscalationRepository(client),
  ) {}

  async listForClinics(clinicIds: string[], status?: "open" | "resolved"): Promise<Result<Escalation[]>> {
    return this.repo.list({ clinicIds, status });
  }

  async countOpen(clinicIds: string[]): Promise<Result<number>> {
    return this.repo.countOpen(clinicIds);
  }

  async resolve(
    actor: ServiceActor,
    id: string,
    notes: string | undefined,
  ): Promise<Result<Escalation>> {
    const existing = await this.repo.findById(id);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Escalation not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Escalation outside actor clinics"));
    }

    const hasPrivilegedRole = actor.memberships.some(
      (membership) =>
        membership.clinicId === existing.value?.clinicId &&
        (membership.role === "owner" || membership.role === "admin"),
    );
    if (!hasPrivilegedRole) {
      return err(AppError.forbidden("Only owner or admin can resolve escalations"));
    }

    return this.repo.resolve(id, { notes, resolvedByUserId: actor.userId });
  }
}
