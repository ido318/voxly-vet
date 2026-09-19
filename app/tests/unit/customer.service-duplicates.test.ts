import { describe, expect, it, vi } from "vitest";
import { CustomerService } from "@/lib/services/customer.service";

const actor = {
  userId: "user1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "owner" as const }],
};

describe("CustomerService duplicate detection", () => {
  it("blocks customer creation when a phone or email duplicate exists in the same clinic", async () => {
    const duplicate = {
      id: "customer-existing",
      clinicId: "clinic1",
      fullName: "Existing Owner",
      phone: "0501234567",
      email: "owner@example.com",
    };
    const customerRepository = {
      findPotentialDuplicates: vi.fn().mockResolvedValue({ ok: true, value: [duplicate] }),
      insert: vi.fn(),
    };
    const service = new CustomerService(
      customerRepository as never,
      { list: vi.fn() } as never,
      { logAction: vi.fn() } as never,
    );

    const result = await service.createCustomer(actor, {
      clinicId: "clinic1",
      fullName: "New Owner",
      phone: "050-123-4567",
      email: "owner@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(409);
      expect(result.error.details).toEqual({ duplicates: [duplicate] });
    }
    expect(customerRepository.insert).not.toHaveBeenCalled();
  });
});
