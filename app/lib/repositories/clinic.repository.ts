import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapClinicRow, mapMembershipRow } from "@/lib/repositories/mappers";
import type { Clinic, ClinicMembershipWithClinic, ClinicSettings } from "@/types/domain/clinic";

type ClinicEmbed = {
  id: string;
  name: string;
  slug: string;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

type MembershipRow = {
  id: string;
  clinic_id: string;
  user_id: string;
  role: "owner" | "admin" | "staff";
  created_at: string;
  updated_at: string;
  clinics: ClinicEmbed | ClinicEmbed[] | null;
};

export class ClinicRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(clinicId: string): Promise<Result<Clinic | null>> {
    const { data, error } = await this.client
      .from("clinics")
      .select("*")
      .eq("id", clinicId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return err(AppError.externalProvider("Failed to load clinic", error));
    }

    return ok(data ? mapClinicRow(data) : null);
  }

  async updateSettings(clinicId: string, settings: ClinicSettings): Promise<Result<Clinic>> {
    const { data, error } = await this.client
      .from("clinics")
      .update({ settings })
      .eq("id", clinicId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return err(AppError.externalProvider("Failed to update clinic settings", error));
    }
    if (!data) {
      return err(AppError.notFound("Clinic not found"));
    }

    return ok(mapClinicRow(data));
  }

  async findMembershipsByUserId(
    userId: string,
  ): Promise<Result<ClinicMembershipWithClinic[]>> {
    const { data, error } = await this.client
      .from("clinic_memberships")
      .select(
        `
        id,
        clinic_id,
        user_id,
        role,
        created_at,
        updated_at,
        clinics (
          id,
          name,
          slug,
          timezone,
          created_at,
          updated_at,
          deleted_at
        )
      `,
      )
      .eq("user_id", userId);

    if (error) {
      return err(
        AppError.externalProvider("Failed to load clinic memberships", error),
      );
    }

    const rows = (data ?? []) as MembershipRow[];

    return ok(
      rows.flatMap((row) => {
        const clinicEmbed = Array.isArray(row.clinics)
          ? row.clinics[0]
          : row.clinics;

        if (!clinicEmbed) {
          return [];
        }

        const membership = mapMembershipRow(row);
        return [
          {
            ...membership,
            clinic: {
              id: clinicEmbed.id,
              name: clinicEmbed.name,
              slug: clinicEmbed.slug,
            },
          },
        ];
      }),
    );
  }
}
