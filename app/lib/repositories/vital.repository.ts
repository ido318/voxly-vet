import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapVitalRow } from "@/lib/repositories/mappers";
import type { CreateVitalInput, Vital } from "@/types/domain/vital";

export class VitalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByPet(clinicId: string, petId: string): Promise<Result<Vital[]>> {
    const { data, error } = await this.client
      .from("vitals")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("pet_id", petId)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false });
    if (error) return err(AppError.externalProvider("Failed to list vitals", error));
    return ok((data ?? []).map(mapVitalRow));
  }

  async create(input: CreateVitalInput, actorUserId: string): Promise<Result<Vital>> {
    const { data, error } = await this.client
      .from("vitals")
      .insert({
        clinic_id: input.clinicId,
        customer_id: input.customerId,
        pet_id: input.petId,
        visit_id: input.visitId ?? null,
        recorded_at: input.recordedAt ?? new Date().toISOString(),
        weight_kg: input.weightKg ?? null,
        temperature_c: input.temperatureC ?? null,
        heart_rate_bpm: input.heartRateBpm ?? null,
        respiratory_rate_bpm: input.respiratoryRateBpm ?? null,
        mucous_membrane: input.mucousMembrane ?? null,
        capillary_refill_time: input.capillaryRefillTime ?? null,
        body_condition_score: input.bodyConditionScore ?? null,
        pain_score: input.painScore ?? null,
        hydration_status: input.hydrationStatus ?? null,
        notes: input.notes ?? null,
        recorded_by_user_id: actorUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create vitals", error));
    return ok(mapVitalRow(data));
  }
}
