import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapEscalationRow } from "@/lib/repositories/mappers";
import type { Escalation, EscalationListFilters, ResolveEscalationInput } from "@/types/domain/escalation";

// The card needs a name to show and a number to dial, not just a reason
// string. customers/pets are joined through the composite FKs added in
// 20260918230000.
const SELECT_WITH_JOINS = "*, customers(full_name), pets(name)";

export class EscalationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: EscalationListFilters): Promise<Result<Escalation[]>> {
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    let query = this.client
      .from("escalations")
      .select(SELECT_WITH_JOINS)
      .in("clinic_id", filters.clinicIds)
      .order("urgency", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.status === "open") {
      query = query.is("resolved_at", null);
    } else if (filters.status === "resolved") {
      query = query.not("resolved_at", "is", null);
    }

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list escalations", error));
    return ok((data ?? []).map(mapEscalationRow));
  }

  async countOpen(clinicIds: string[]): Promise<Result<number>> {
    const { count, error } = await this.client
      .from("escalations")
      .select("*", { count: "exact", head: true })
      .in("clinic_id", clinicIds)
      .is("resolved_at", null);

    if (error) return err(AppError.externalProvider("Failed to count escalations", error));
    return ok(count ?? 0);
  }

  async findById(id: string): Promise<Result<Escalation | null>> {
    const { data, error } = await this.client
      .from("escalations")
      .select(SELECT_WITH_JOINS)
      .eq("id", id)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load escalation", error));
    return ok(data ? mapEscalationRow(data as Record<string, unknown>) : null);
  }

  async resolve(id: string, input: ResolveEscalationInput): Promise<Result<Escalation>> {
    const { data, error } = await this.client
      .from("escalations")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: input.resolvedByUserId,
        // Safe to write now: the agent's triage context moved to its own
        // `context` column, so a human's note no longer destroys it.
        notes: input.notes ?? null,
      })
      .eq("id", id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(AppError.notFound("Escalation not found"));
      }
      return err(AppError.externalProvider("Failed to resolve escalation", error));
    }
    return ok(mapEscalationRow(data as Record<string, unknown>));
  }
}
