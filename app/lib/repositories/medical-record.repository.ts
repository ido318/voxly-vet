import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapMedicalRecordRow } from "@/lib/repositories/mappers";
import type { MedicalRecord, UpdateMedicalRecordInput } from "@/types/domain/medical-record";

export class MedicalRecordRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByPet(clinicId: string, petId: string): Promise<Result<MedicalRecord | null>> {
    const { data, error } = await this.client
      .from("medical_records")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("pet_id", petId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load medical record", error));
    return ok(data ? mapMedicalRecordRow(data) : null);
  }

  async createForPet(clinicId: string, petId: string): Promise<Result<MedicalRecord>> {
    const { data, error } = await this.client
      .from("medical_records")
      .insert({ clinic_id: clinicId, pet_id: petId })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create medical record", error));
    return ok(mapMedicalRecordRow(data));
  }

  async update(recordId: string, input: UpdateMedicalRecordInput): Promise<Result<MedicalRecord>> {
    const { data, error } = await this.client
      .from("medical_records")
      .update({
        summary: input.summary,
        active_problem_list: input.activeProblemList,
        alerts: input.alerts,
      })
      .eq("id", recordId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to update medical record", error));
    return ok(mapMedicalRecordRow(data));
  }
}
