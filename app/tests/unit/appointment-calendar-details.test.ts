import { describe, expect, it } from "vitest";
import { mapAppointmentRow } from "@/lib/repositories/mappers";

const baseAppointmentRow = {
  id: "appointment-1",
  clinic_id: "clinic-1",
  customer_id: "customer-1",
  pet_id: "pet-1",
  appointment_type: "checkup" as const,
  status: "scheduled" as const,
  source: "phone" as const,
  scheduled_at: "2026-06-21T06:00:00.000Z",
  duration_minutes: 40,
  reason: "בדיקה כללית",
  notes: null,
  version: 0,
  cancelled_at: null,
  cancelled_by_user_id: null,
  cancellation_reason: null,
  created_by_user_id: null,
  created_at: "2026-06-20T20:00:00.000Z",
  updated_at: "2026-06-20T20:00:00.000Z",
  deleted_at: null,
};

describe("calendar appointment details", () => {
  it("maps joined customer and pet details for rich calendar blocks", () => {
    const appointment = mapAppointmentRow({
      ...baseAppointmentRow,
      customer: { full_name: "יעל ברקוביץ׳", phone: "+972501234567" },
      pet: { name: "לונה", species: "dog" },
    });

    expect(appointment.customerName).toBe("יעל ברקוביץ׳");
    expect(appointment.customerPhone).toBe("+972501234567");
    expect(appointment.petName).toBe("לונה");
    expect(appointment.petSpecies).toBe("dog");
  });

  it("defaults customerPhone to null when the customer join has no phone", () => {
    const appointment = mapAppointmentRow({
      ...baseAppointmentRow,
      customer: { full_name: "יעל ברקוביץ׳", phone: null },
      pet: { name: "לונה", species: "dog" },
    });

    expect(appointment.customerPhone).toBeNull();
  });
});
