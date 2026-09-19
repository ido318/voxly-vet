import { describe, expect, it, vi } from "vitest";
import { CustomerRepository } from "@/lib/repositories/customer.repository";

describe("CustomerRepository.findPotentialDuplicates", () => {
  it("searches only active customers in the requested clinic", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [
          {
            id: "c1",
            clinic_id: "clinic1",
            full_name: "דנה כהן",
            phone: "0501234567",
            email: "owner@example.com",
            address: null,
            preferred_contact_method: "phone",
            notes: null,
            status: "active",
            created_at: "2026-08-31T10:00:00.000Z",
            updated_at: "2026-08-31T10:00:00.000Z",
            deleted_at: null,
          },
        ],
        error: null,
      }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new CustomerRepository(client as never);

    const result = await repository.findPotentialDuplicates("clinic1", {
      phone: "050-123-4567",
      email: "other@example.com",
    });

    expect(result.ok).toBe(true);
    expect(client.from).toHaveBeenCalledWith("customers");
    expect(query.eq).toHaveBeenCalledWith("clinic_id", "clinic1");
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.id).toBe("c1");
    }
  });
});
