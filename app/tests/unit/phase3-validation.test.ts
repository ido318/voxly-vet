import { describe, expect, it } from "vitest";
import {
  changeStatusSchema,
  createAppointmentSchema,
  deleteAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from "@/lib/validators/appointment";

describe("phase3 validators", () => {
  it("accepts valid checkup payload with 40 minute effective duration", () => {
    const result = createAppointmentSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      customerId: "00000000-0000-4000-8000-000000000010",
      petId: "00000000-0000-4000-8000-000000000011",
      appointmentType: "checkup",
      source: "front_desk",
      scheduledAt: new Date().toISOString(),
      durationMinutes: 40,
    });
    expect(result.success).toBe(true);
  });

  it("accepts home visit with 90 minute effective duration", () => {
    const result = createAppointmentSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      customerId: "00000000-0000-4000-8000-000000000010",
      petId: "00000000-0000-4000-8000-000000000011",
      appointmentType: "home_visit",
      source: "phone",
      scheduledAt: new Date().toISOString(),
      durationMinutes: 90,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration that does not match appointment type", () => {
    const result = createAppointmentSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      customerId: "00000000-0000-4000-8000-000000000010",
      petId: "00000000-0000-4000-8000-000000000011",
      appointmentType: "home_visit",
      source: "phone",
      scheduledAt: new Date().toISOString(),
      durationMinutes: 30,
    });
    expect(result.success).toBe(false);
  });

  it("requires version for status changes", () => {
    const result = changeStatusSchema.safeParse({ status: "confirmed" });
    expect(result.success).toBe(false);
  });

  it("requires update payload and version for updates", () => {
    const result = updateAppointmentSchema.safeParse({ version: 0, data: {} });
    expect(result.success).toBe(false);
  });

  it("requires version for appointment deletes", () => {
    const result = deleteAppointmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts Israel timezone offsets for calendar appointment list ranges", () => {
    const result = listAppointmentsSchema.safeParse({
      from: "2026-06-21T00:00:00+03:00",
      to: "2026-06-27T23:59:00+03:00",
    });

    expect(result.success).toBe(true);
  });
});
