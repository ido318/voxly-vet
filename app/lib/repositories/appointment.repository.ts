import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { SLOT_BLOCKING_STATUSES } from "@/lib/appointment-rules";
import { mapAppointmentRow } from "@/lib/repositories/mappers";
import type {
  Appointment,
  AppointmentListFilters,
  CreateAppointmentInput,
} from "@/types/domain/appointment";

function isExclusionConstraintError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23P01" ||
    (error.message?.includes("appointments_no_active_overlap") ?? false)
  );
}

type VersionedUpdatePayload = {
  expectedVersion: number;
  data: Partial<{
    appointment_type: string;
    source: string;
    scheduled_at: string;
    duration_minutes: number;
    reason: string | null;
    notes: string | null;
    status: string;
    cancelled_at: string | null;
    cancelled_by_user_id: string | null;
    cancellation_reason: string | null;
    deleted_at: string | null;
    changed_via: "agent" | "dashboard";
  }>;
};

export class AppointmentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: AppointmentListFilters): Promise<Result<Appointment[]>> {
    let query = this.client
      .from("appointments")
      .select(`
        *,
        customer:customers!appointments_customer_clinic_fk(full_name, phone),
        pet:pets!appointments_pet_clinic_fk(name, species)
      `)
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.petId) query = query.eq("pet_id", filters.petId);
    if (filters.from) query = query.gte("scheduled_at", filters.from);
    if (filters.to) query = query.lt("scheduled_at", filters.to);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list appointments", error));
    return ok((data ?? []).map(mapAppointmentRow));
  }

  async findById(appointmentId: string): Promise<Result<Appointment | null>> {
    const { data, error } = await this.client
      .from("appointments")
      .select(`
        *,
        customer:customers!appointments_customer_clinic_fk(full_name, phone),
        pet:pets!appointments_pet_clinic_fk(name, species)
      `)
      .eq("id", appointmentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load appointment", error));
    return ok(data ? mapAppointmentRow(data) : null);
  }

  async create(input: CreateAppointmentInput, actorUserId: string): Promise<Result<Appointment>> {
    const { data, error } = await this.client
      .from("appointments")
      .insert({
        clinic_id: input.clinicId,
        customer_id: input.customerId,
        pet_id: input.petId,
        appointment_type: input.appointmentType,
        status: "scheduled",
        source: input.source,
        scheduled_at: input.scheduledAt,
        duration_minutes: input.durationMinutes,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        created_by_user_id: actorUserId,
      })
      .select("*")
      .single();
    if (error) {
      if (isExclusionConstraintError(error)) {
        return err(AppError.conflict("Appointment overlaps with an active appointment", error));
      }
      return err(AppError.externalProvider("Failed to create appointment", error));
    }
    return ok(mapAppointmentRow(data));
  }

  async updateVersioned(
    appointmentId: string,
    payload: VersionedUpdatePayload,
  ): Promise<Result<Appointment>> {
    const { data, error } = await this.client
      .from("appointments")
      .update({
        ...payload.data,
        version: payload.expectedVersion + 1,
      })
      .eq("id", appointmentId)
      .eq("version", payload.expectedVersion)
      .is("deleted_at", null)
      .select(`
        *,
        customer:customers!appointments_customer_clinic_fk(full_name, phone),
        pet:pets!appointments_pet_clinic_fk(name, species)
      `)
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(
          AppError.conflict("Appointment update conflict: stale version", {
            appointmentId,
            expectedVersion: payload.expectedVersion,
          }),
        );
      }
      if (isExclusionConstraintError(error)) {
        return err(AppError.conflict("Appointment overlaps with an active appointment", error));
      }
      return err(AppError.externalProvider("Failed to update appointment", error));
    }
    return ok(mapAppointmentRow(data));
  }

  async findActiveOverlaps(
    clinicId: string,
    scheduledAt: string,
    durationMinutes: number,
    excludeAppointmentId?: string,
  ): Promise<Result<Appointment[]>> {
    const startIso = new Date(scheduledAt).toISOString();
    const endIso = new Date(
      new Date(scheduledAt).getTime() + durationMinutes * 60_000,
    ).toISOString();

    let query = this.client
      .from("appointments")
      .select("*")
      .eq("clinic_id", clinicId)
      .in("status", [...SLOT_BLOCKING_STATUSES])
      .is("deleted_at", null)
      .lt("scheduled_at", endIso);

    if (excludeAppointmentId) query = query.neq("id", excludeAppointmentId);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to check overlaps", error));
    const overlaps = (data ?? [])
      .map(mapAppointmentRow)
      .filter((row) => {
        const rowStart = new Date(row.scheduledAt).getTime();
        const rowEnd = rowStart + row.durationMinutes * 60_000;
        const reqStart = new Date(startIso).getTime();
        const reqEnd = new Date(endIso).getTime();
        return reqStart < rowEnd && reqEnd > rowStart;
      });

    return ok(overlaps);
  }
}
