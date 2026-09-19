import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapPetRow } from "@/lib/repositories/mappers";
import { postgrestOrIlikeValue } from "@/lib/search/escape-postgrest";
import type { CreatePetInput, Pet, PetListFilters, UpdatePetInput } from "@/types/domain/pet";

export class PetRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: PetListFilters): Promise<Result<Pet[]>> {
    let query = this.client
      .from("pets")
      .select("*")
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }

    if (filters.query) {
      const value = postgrestOrIlikeValue(filters.query);
      query = query.or(`name.ilike.${value},species.ilike.${value},chip_number.ilike.${value}`);
    }

    const { data, error } = await query;
    if (error) {
      return err(AppError.externalProvider("Failed to list pets", error));
    }
    return ok((data ?? []).map(mapPetRow));
  }

  async findById(petId: string): Promise<Result<Pet | null>> {
    const { data, error } = await this.client
      .from("pets")
      .select("*")
      .eq("id", petId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return err(AppError.externalProvider("Failed to load pet", error));
    }
    return ok(data ? mapPetRow(data) : null);
  }

  async insert(input: CreatePetInput): Promise<Result<Pet>> {
    const { data, error } = await this.client
      .from("pets")
      .insert({
        clinic_id: input.clinicId,
        customer_id: input.customerId,
        name: input.name,
        species: input.species,
        breed: input.breed ?? null,
        sex: input.sex ?? null,
        birth_date: input.birthDate ?? null,
        weight: input.weight ?? null,
        chip_number: input.chipNumber ?? null,
        is_neutered: input.isNeutered ?? false,
        allergies: input.allergies ?? null,
        chronic_conditions: input.chronicConditions ?? null,
        current_medications: input.currentMedications ?? null,
        notes: input.notes ?? null,
        profile_image_url: input.profileImageUrl ?? null,
        status: input.status ?? "active",
      })
      .select("*")
      .single();

    if (error) {
      return err(AppError.externalProvider("Failed to create pet", error));
    }
    return ok(mapPetRow(data));
  }

  async update(petId: string, input: UpdatePetInput): Promise<Result<Pet>> {
    const { data, error } = await this.client
      .from("pets")
      .update({
        name: input.name,
        species: input.species,
        breed: input.breed,
        sex: input.sex,
        birth_date: input.birthDate,
        weight: input.weight,
        chip_number: input.chipNumber,
        is_neutered: input.isNeutered,
        allergies: input.allergies,
        chronic_conditions: input.chronicConditions,
        current_medications: input.currentMedications,
        notes: input.notes,
        profile_image_url: input.profileImageUrl,
        status: input.status,
      })
      .eq("id", petId)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      return err(AppError.externalProvider("Failed to update pet", error));
    }
    return ok(mapPetRow(data));
  }

  async softDelete(petId: string): Promise<Result<void>> {
    const { error } = await this.client
      .from("pets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", petId)
      .is("deleted_at", null);

    if (error) {
      return err(AppError.externalProvider("Failed to delete pet", error));
    }
    return ok(undefined);
  }
}
