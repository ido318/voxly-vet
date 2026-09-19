import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapPrescriptionRow } from "@/lib/repositories/mappers";
import type {
  CreatePrescriptionInput,
  Prescription,
  UpdatePrescriptionInput,
} from "@/types/domain/prescription";

export class PrescriptionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByVisit(visitId: string): Promise<Result<Prescription[]>> {
    const { data, error } = await this.client
      .from("prescriptions")
      .select("*")
      .eq("visit_id", visitId)
      .is("deleted_at", null)
      .order("prescribed_at", { ascending: false });
    if (error) return err(AppError.externalProvider("Failed to list prescriptions", error));
    return ok((data ?? []).map(mapPrescriptionRow));
  }

  async listByPet(petId: string): Promise<Result<Prescription[]>> {
    const { data, error } = await this.client
      .from("prescriptions")
      .select("*")
      .eq("pet_id", petId)
      .is("deleted_at", null)
      .order("prescribed_at", { ascending: false });
    if (error) return err(AppError.externalProvider("Failed to list prescriptions", error));
    return ok((data ?? []).map(mapPrescriptionRow));
  }

  async findById(prescriptionId: string): Promise<Result<Prescription | null>> {
    const { data, error } = await this.client
      .from("prescriptions")
      .select("*")
      .eq("id", prescriptionId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load prescription", error));
    return ok(data ? mapPrescriptionRow(data) : null);
  }

  async create(
    clinicId: string,
    visitId: string,
    petId: string,
    input: CreatePrescriptionInput,
    actorUserId: string,
  ): Promise<Result<Prescription>> {
    const { data, error } = await this.client
      .from("prescriptions")
      .insert({
        clinic_id: clinicId,
        visit_id: visitId,
        pet_id: petId,
        medication_name: input.medicationName,
        instructions: input.instructions,
        status: input.status ?? "draft",
        notes: input.notes ?? null,
        prescribed_by_user_id: actorUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create prescription", error));
    return ok(mapPrescriptionRow(data));
  }

  async update(
    prescriptionId: string,
    input: UpdatePrescriptionInput,
  ): Promise<Result<Prescription>> {
    const { data, error } = await this.client
      .from("prescriptions")
      .update({
        medication_name: input.medicationName,
        instructions: input.instructions,
        status: input.status,
        discontinued_at: input.discontinuedAt,
        notes: input.notes,
      })
      .eq("id", prescriptionId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to update prescription", error));
    return ok(mapPrescriptionRow(data));
  }

  async softDelete(prescriptionId: string): Promise<Result<Prescription>> {
    const { data, error } = await this.client
      .from("prescriptions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", prescriptionId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to delete prescription", error));
    return ok(mapPrescriptionRow(data));
  }
}
