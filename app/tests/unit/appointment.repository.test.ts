import { describe, expect, it, vi } from "vitest";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";

const clinicId = "00000000-0000-4000-8000-000000000001";
const customerId = "10000000-0000-4000-8000-000000000001";
const petId = "20000000-0000-4000-8000-000000000001";
const appointmentId = "40000000-0000-4000-8000-000000000001";

const baseRow = {
  id: appointmentId,
  clinic_id: clinicId,
  customer_id: customerId,
  pet_id: petId,
  customer: { full_name: "דנה", phone: "+972500000000" },
  pet: { name: "מיקה", species: "dog" },
  appointment_type: "home_visit",
  status: "confirmed",
  source: "front_desk",
  scheduled_at: "2027-01-15T10:00:00.000Z",
  duration_minutes: 90,
  reason: null,
  notes: null,
  version: 1,
  cancelled_at: null,
  cancelled_by_user_id: null,
  cancellation_reason: null,
  created_by_user_id: null,
  created_at: "2027-01-01T09:00:00.000Z",
  updated_at: "2027-01-01T09:00:00.000Z",
  deleted_at: null,
};

describe("AppointmentRepository.findById", () => {
  it("selects with the customer/pet embed, same as list()", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: baseRow, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new AppointmentRepository(client as never);

    await repository.findById(appointmentId);

    const selectArg = query.select.mock.calls[0]?.[0] as string;
    expect(selectArg).toContain("customer:customers!appointments_customer_clinic_fk(full_name, phone)");
    expect(selectArg).toContain("pet:pets!appointments_pet_clinic_fk(name, species)");
  });

  it("maps customerName/customerPhone/petName from the joined row", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: baseRow, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new AppointmentRepository(client as never);

    const result = await repository.findById(appointmentId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.customerName).toBe("דנה");
    expect(result.value?.customerPhone).toBe("+972500000000");
    expect(result.value?.petName).toBe("מיקה");
  });
});

describe("AppointmentRepository.updateVersioned", () => {
  it("selects with the customer/pet embed after the update, same as list()", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { ...baseRow, version: 2 }, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new AppointmentRepository(client as never);

    await repository.updateVersioned(appointmentId, {
      expectedVersion: 1,
      data: { notes: "updated" },
    });

    const selectArg = query.select.mock.calls[0]?.[0] as string;
    expect(selectArg).toContain("customer:customers!appointments_customer_clinic_fk(full_name, phone)");
    expect(selectArg).toContain("pet:pets!appointments_pet_clinic_fk(name, species)");
  });

  it("maps customerName/customerPhone/petName from the joined row", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { ...baseRow, version: 2 }, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new AppointmentRepository(client as never);

    const result = await repository.updateVersioned(appointmentId, {
      expectedVersion: 1,
      data: { notes: "updated" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.customerName).toBe("דנה");
    expect(result.value.customerPhone).toBe("+972500000000");
    expect(result.value.petName).toBe("מיקה");
  });
});
