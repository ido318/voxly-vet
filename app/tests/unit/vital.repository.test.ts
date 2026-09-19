import { describe, expect, it, vi } from "vitest";
import { VitalRepository } from "@/lib/repositories/vital.repository";

describe("VitalRepository", () => {
  it("lists vitals for a pet in reverse recorded order", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: "vital1",
        clinic_id: "clinic1",
        customer_id: "customer1",
        pet_id: "pet1",
        visit_id: null,
        recorded_at: "2026-08-31T09:00:00.000Z",
        weight_kg: 12.5,
        temperature_c: 38.4,
        heart_rate_bpm: null,
        respiratory_rate_bpm: null,
        mucous_membrane: null,
        capillary_refill_time: null,
        body_condition_score: null,
        pain_score: null,
        hydration_status: null,
        notes: null,
        recorded_by_user_id: "user1",
        version: 0,
        created_at: "2026-08-31T09:00:00.000Z",
        updated_at: "2026-08-31T09:00:00.000Z",
        deleted_at: null,
      }],
      error: null,
    });
    const is = vi.fn().mockReturnValue({ order });
    const eqPet = vi.fn().mockReturnValue({ is });
    const eqClinic = vi.fn().mockReturnValue({ eq: eqPet });
    const select = vi.fn().mockReturnValue({ eq: eqClinic });
    const client = { from: vi.fn().mockReturnValue({ select }) };
    const repository = new VitalRepository(client as never);

    const result = await repository.listByPet("clinic1", "pet1");

    expect(result.ok).toBe(true);
    expect(client.from).toHaveBeenCalledWith("vitals");
    expect(order).toHaveBeenCalledWith("recorded_at", { ascending: false });
    if (result.ok) {
      expect(result.value[0]).toMatchObject({ id: "vital1", weightKg: 12.5, temperatureC: 38.4 });
    }
  });
});
