import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapVaccinationRow } from "@/lib/repositories/mappers";
import type {
  CreateVaccinationInput,
  UpdateVaccinationInput,
  Vaccination,
} from "@/types/domain/vaccination";

export class VaccinationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByPet(petId: string, clinicId: string): Promise<Result<Vaccination[]>> {
    const { data, error } = await this.client
      .from("vaccinations")
      .select("*")
      .eq("pet_id", petId)
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .order("administered_at", { ascending: false });
    if (error) return err(AppError.externalProvider("Failed to list vaccinations", error));
    return ok((data ?? []).map(mapVaccinationRow));
  }

  async findById(vaccinationId: string): Promise<Result<Vaccination | null>> {
    const { data, error } = await this.client
      .from("vaccinations")
      .select("*")
      .eq("id", vaccinationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load vaccination", error));
    return ok(data ? mapVaccinationRow(data) : null);
  }

  async create(
    input: CreateVaccinationInput,
    actorUserId: string,
    petId: string,
  ): Promise<Result<Vaccination>> {
    const { data, error } = await this.client
      .from("vaccinations")
      .insert({
        clinic_id: input.clinicId,
        pet_id: petId,
        customer_id: input.customerId,
        visit_id: input.visitId ?? null,
        vaccine_name: input.vaccineName,
        administered_at: input.administeredAt,
        batch_number: input.batchNumber ?? null,
        next_due_at: input.nextDueAt ?? null,
        notes: input.notes ?? null,
        administered_by_user_id: actorUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create vaccination", error));
    return ok(mapVaccinationRow(data));
  }

  async update(
    vaccinationId: string,
    input: UpdateVaccinationInput,
  ): Promise<Result<Vaccination>> {
    const { data, error } = await this.client
      .from("vaccinations")
      .update({
        vaccine_name: input.vaccineName,
        administered_at: input.administeredAt,
        visit_id: input.visitId,
        batch_number: input.batchNumber,
        next_due_at: input.nextDueAt,
        notes: input.notes,
      })
      .eq("id", vaccinationId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to update vaccination", error));
    return ok(mapVaccinationRow(data));
  }

  async softDelete(vaccinationId: string): Promise<Result<Vaccination>> {
    const { data, error } = await this.client
      .from("vaccinations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", vaccinationId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to delete vaccination", error));
    return ok(mapVaccinationRow(data));
  }
}
