import { describe, expect, it, vi } from "vitest";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { ErrorCodes } from "@/lib/errors/app-error";

const visitRow = {
  id: "50000000-0000-4000-8000-000000000001",
  clinic_id: "00000000-0000-4000-8000-000000000001",
  customer_id: "10000000-0000-4000-8000-000000000001",
  pet_id: "20000000-0000-4000-8000-000000000001",
  appointment_id: "40000000-0000-4000-8000-000000000001",
  medical_record_id: "60000000-0000-4000-8000-000000000001",
  status: "in_progress",
  chief_complaint: "בדיקה כללית",
  manual_visit_summary: null,
  ai_visit_summary: null,
  ai_summary_generated_at: null,
  ai_summary_accepted_by_user_id: null,
  started_at: "2026-09-01T06:10:00.000Z",
  completed_at: null,
  version: 0,
  created_by_user_id: "30000000-0000-4000-8000-000000000001",
  created_at: "2026-09-01T06:10:00.000Z",
  updated_at: "2026-09-01T06:10:00.000Z",
  deleted_at: null,
};

describe("VisitRepository.openFromAppointment", () => {
  it("calls the atomic RPC and maps the returned visit row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: visitRow, error: null });
    const repository = new VisitRepository({ rpc } as never);

    const result = await repository.openFromAppointment({
      appointmentId: visitRow.appointment_id,
      expectedVersion: 3,
      medicalRecordId: visitRow.medical_record_id,
      chiefComplaint: visitRow.chief_complaint,
      createdByUserId: visitRow.created_by_user_id,
    });

    expect(rpc).toHaveBeenCalledWith("open_visit_from_appointment", {
      p_appointment_id: visitRow.appointment_id,
      p_expected_version: 3,
      p_medical_record_id: visitRow.medical_record_id,
      p_chief_complaint: visitRow.chief_complaint,
      p_created_by_user_id: visitRow.created_by_user_id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(visitRow.id);
    expect(result.value.appointmentId).toBe(visitRow.appointment_id);
  });

  it("returns the existing visit when the unique index is hit (23505)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: visitRow, error: null });
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    const client = {
      rpc,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle,
      }),
    };
    const repository = new VisitRepository(client as never);

    const result = await repository.openFromAppointment({
      appointmentId: visitRow.appointment_id,
      expectedVersion: 3,
      medicalRecordId: visitRow.medical_record_id,
      chiefComplaint: visitRow.chief_complaint,
      createdByUserId: visitRow.created_by_user_id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(visitRow.id);
  });

  it("maps stale_version to AppError.conflict", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "stale_version" },
    });
    const repository = new VisitRepository({ rpc } as never);

    const result = await repository.openFromAppointment({
      appointmentId: visitRow.appointment_id,
      expectedVersion: 3,
      medicalRecordId: visitRow.medical_record_id,
      chiefComplaint: visitRow.chief_complaint,
      createdByUserId: visitRow.created_by_user_id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ErrorCodes.CONFLICT);
  });
});
