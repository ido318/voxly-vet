import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapFollowUpRow } from "@/lib/repositories/mappers";
import type {
  CreateFollowUpInput,
  FollowUp,
  FollowUpListFilters,
} from "@/types/domain/follow-up";

const SELECT_WITH_JOINS = `
  *,
  customer:customers!follow_ups_customer_clinic_fk(full_name),
  pet:pets!follow_ups_pet_clinic_fk(name)
`;

export class FollowUpRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: FollowUpListFilters): Promise<Result<FollowUp[]>> {
    let query = this.client
      .from("follow_ups")
      .select(SELECT_WITH_JOINS)
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("due_at", { ascending: true });

    if (filters.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list follow-ups", error));
    return ok((data ?? []).map(mapFollowUpRow));
  }

  async findById(followUpId: string): Promise<Result<FollowUp | null>> {
    const { data, error } = await this.client
      .from("follow_ups")
      .select(SELECT_WITH_JOINS)
      .eq("id", followUpId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load follow-up", error));
    return ok(data ? mapFollowUpRow(data) : null);
  }

  async create(
    input: CreateFollowUpInput & { taskId?: string | null; createdByUserId: string },
  ): Promise<Result<FollowUp>> {
    const { data, error } = await this.client
      .from("follow_ups")
      .insert({
        clinic_id: input.clinicId,
        customer_id: input.customerId,
        pet_id: input.petId ?? null,
        visit_id: input.visitId ?? null,
        voice_call_id: input.voiceCallId ?? null,
        task_id: input.taskId ?? null,
        reason: input.reason,
        due_at: input.dueAt,
        created_by_user_id: input.createdByUserId,
      })
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) return err(AppError.externalProvider("Failed to create follow-up", error));
    return ok(mapFollowUpRow(data));
  }

  async updateVersioned(
    followUpId: string,
    expectedVersion: number,
    patch: Record<string, unknown>,
  ): Promise<Result<FollowUp>> {
    const { data, error } = await this.client
      .from("follow_ups")
      .update({ ...patch, version: expectedVersion + 1 })
      .eq("id", followUpId)
      .eq("version", expectedVersion)
      .is("deleted_at", null)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(AppError.conflict("Follow-up update conflict: stale version", {
          followUpId,
          expectedVersion,
        }));
      }
      return err(AppError.externalProvider("Failed to update follow-up", error));
    }
    return ok(mapFollowUpRow(data));
  }
}
