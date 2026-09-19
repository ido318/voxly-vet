import { describe, expect, it } from "vitest";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validators/customer";
import { createPetSchema, updatePetSchema } from "@/lib/validators/pet";

describe("phase2 validators", () => {
  it("validates customer payload including whatsapp enum value", () => {
    const result = createCustomerSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      fullName: "Dana Cohen",
      preferredContactMethod: "whatsapp",
      status: "active",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty customer update payload", () => {
    const result = updateCustomerSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates pet payload with required fields", () => {
    const result = createPetSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      customerId: "00000000-0000-4000-8000-000000000010",
      name: "Luna",
      species: "dog",
      status: "active",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty pet update payload", () => {
    const result = updatePetSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
