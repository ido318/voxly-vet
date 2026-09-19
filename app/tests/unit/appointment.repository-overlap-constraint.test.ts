import { describe, expect, it, vi } from "vitest";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import { ErrorCodes } from "@/lib/errors/app-error";

const clinicId = "00000000-0000-4000-8000-000000000001";
const customerId = "10000000-0000-4000-8000-000000000001";
const petId = "20000000-0000-4000-8000-000000000001";
const appointmentId = "40000000-0000-4000-8000-000000000001";

const overlapError = {
  code: "23P01",
  message: "conflicting key value violates exclusion constraint \"appointments_no_active_overlap\"",
};

describe("AppointmentRepository exclusion constraint mapping", () => {
  it("maps 23P01 on create to AppError.conflict instead of a generic 502", async () => {
    const query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: overlapError }),
    };
    const repository = new AppointmentRepository({ from: vi.fn().mockReturnValue(query) } as never);

    const result = await repository.create(
      {
        clinicId,
        customerId,
        petId,
        appointmentType: "checkup",
        source: "front_desk",
        scheduledAt: "2027-01-15T10:00:00.000Z",
        durationMinutes: 40,
      },
      "user-1",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ErrorCodes.CONFLICT);
    expect(result.error.status).toBe(409);
    expect(result.error.message).toContain("overlaps");
  });

  it("maps 23P01 on updateVersioned to AppError.conflict instead of a generic 502", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: overlapError }),
    };
    const repository = new AppointmentRepository({ from: vi.fn().mockReturnValue(query) } as never);

    const result = await repository.updateVersioned(appointmentId, {
      expectedVersion: 1,
      data: { scheduled_at: "2027-01-15T11:00:00.000Z" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ErrorCodes.CONFLICT);
    expect(result.error.status).toBe(409);
  });
});
