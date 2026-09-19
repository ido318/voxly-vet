import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapVisitRow } from "@/lib/repositories/mappers";
import type {
  CreateVisitInput,
  Visit,
  VisitListFilters,
  VisitStatus,
} from "@/types/domain/visit";

type VersionedUpdatePayload = {
  expectedVersion: number;
    data: Partial<{
      appointment_id: string | null;
      medical_record_id: string | null;
      status: VisitStatus;
    chief_complaint: string | null;
    manual_visit_summary: string | null;
    completed_at: string | null;
    deleted_at: string | null;
  }>;
};

export type AcceptAiVisitSummaryPayload = {
  expectedVersion: number;
  aiVisitSummary: string;
  acceptedByUserId: string;
  acceptedAt: string;
};

export class VisitRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: VisitListFilters): Promise<Result<Visit[]>> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    let query = this.client
      .from("visits")
      .select("*")
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.petId) query = query.eq("pet_id", filters.petId);
    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.from) query = query.gte("started_at", filters.from);
    if (filters.to) query = query.lt("started_at", filters.to);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list visits", error));
    return ok((data ?? []).map(mapVisitRow));
  }

  async findById(visitId: string): Promise<Result<Visit | null>> {
    const { data, error } = await this.client
      .from("visits")
      .select("*")
      .eq("id", visitId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load visit", error));
    return ok(data ? mapVisitRow(data) : null);
  }

  async findByAppointment(appointmentId: string): Promise<Result<Visit | null>> {
    const { data, error } = await this.client
      .from("visits")
      .select("*")
      .eq("appointment_id", appointmentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load appointment visit", error));
    return ok(data ? mapVisitRow(data) : null);
  }

  async create(input: CreateVisitInput, actorUserId: string): Promise<Result<Visit>> {
    const { data, error } = await this.client
      .from("visits")
      .insert({
        clinic_id: input.clinicId,
        customer_id: input.customerId,
        pet_id: input.petId,
        appointment_id: input.appointmentId ?? null,
        medical_record_id: input.medicalRecordId ?? null,
        chief_complaint: input.chiefComplaint ?? null,
        manual_visit_summary: input.manualVisitSummary ?? null,
        created_by_user_id: actorUserId,
      })
      .select("*")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505" && input.appointmentId) {
        const existing = await this.findByAppointment(input.appointmentId);
        if (existing.ok && existing.value) return ok(existing.value);
        return err(AppError.conflict("A visit already exists for this appointment", error));
      }
      return err(AppError.externalProvider("Failed to create visit", error));
    }
    return ok(mapVisitRow(data));
  }

  /**
   * Atomically insert a visit and mark the appointment in_visit
   * (open_visit_from_appointment RPC). Concurrent callers get the same visit.
   */
  async openFromAppointment(input: {
    appointmentId: string;
    expectedVersion: number;
    medicalRecordId: string;
    chiefComplaint: string | null;
    createdByUserId: string;
  }): Promise<Result<Visit>> {
    const { data, error } = await this.client.rpc("open_visit_from_appointment", {
      p_appointment_id: input.appointmentId,
      p_expected_version: input.expectedVersion,
      p_medical_record_id: input.medicalRecordId,
      p_chief_complaint: input.chiefComplaint,
      p_created_by_user_id: input.createdByUserId,
    });

    if (error) {
      const code = (error as { code?: string }).code;
      const message = error.message ?? "";
      if (code === "23505") {
        const existing = await this.findByAppointment(input.appointmentId);
        if (existing.ok && existing.value) return ok(existing.value);
        return err(AppError.conflict("A visit already exists for this appointment", error));
      }
      if (message.includes("appointment_not_found") || code === "P0002") {
        return err(AppError.notFound("Appointment not found"));
      }
      if (message.includes("stale_version")) {
        return err(
          AppError.conflict("Appointment update conflict: stale version", {
            appointmentId: input.appointmentId,
            expectedVersion: input.expectedVersion,
          }),
        );
      }
      if (message.includes("invalid_status")) {
        return err(AppError.validation("Only checked_in appointments can be opened as visits"));
      }
      return err(AppError.externalProvider("Failed to open visit from appointment", error));
    }

    return ok(mapVisitRow(data));
  }

  async updateVersioned(
    visitId: string,
    payload: VersionedUpdatePayload,
  ): Promise<Result<Visit>> {
    const { data, error } = await this.client
      .from("visits")
      .update({
        ...payload.data,
        version: payload.expectedVersion + 1,
      })
      .eq("id", visitId)
      .eq("version", payload.expectedVersion)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(
          AppError.conflict("Visit update conflict: stale version", {
            visitId,
            expectedVersion: payload.expectedVersion,
          }),
        );
      }
      return err(AppError.externalProvider("Failed to update visit", error));
    }
    return ok(mapVisitRow(data));
  }

  async acceptAiSummary(
    visitId: string,
    payload: AcceptAiVisitSummaryPayload,
  ): Promise<Result<Visit>> {
    const { data, error } = await this.client
      .from("visits")
      .update({
        ai_visit_summary: payload.aiVisitSummary,
        ai_summary_generated_at: payload.acceptedAt,
        ai_summary_accepted_by_user_id: payload.acceptedByUserId,
        version: payload.expectedVersion + 1,
      })
      .eq("id", visitId)
      .eq("version", payload.expectedVersion)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(
          AppError.conflict("Visit update conflict: stale version", {
            visitId,
            expectedVersion: payload.expectedVersion,
          }),
        );
      }
      return err(AppError.externalProvider("Failed to accept AI visit summary", error));
    }
    return ok(mapVisitRow(data));
  }
}
