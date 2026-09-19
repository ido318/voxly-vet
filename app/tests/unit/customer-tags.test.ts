import { describe, expect, it, vi } from "vitest";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { mapCustomerRow } from "@/lib/repositories/mappers";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validators/customer";

describe("customer tags validator", () => {
  it("accepts a normal set of tags", () => {
    const result = createCustomerSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      fullName: "דנה כהן",
      tags: ["VIP", "רגיש להרדמה"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 10 tags", () => {
    const result = createCustomerSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      fullName: "דנה כהן",
      tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty-string tag", () => {
    const result = createCustomerSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      fullName: "דנה כהן",
      tags: [""],
    });
    expect(result.success).toBe(false);
  });

  it("is optional on a partial update", () => {
    const result = updateCustomerSchema.safeParse({ fullName: "דנה כהן" });
    expect(result.success).toBe(true);
  });
});

describe("mapCustomerRow tags", () => {
  it("defaults a null tags column to an empty array", () => {
    const customer = mapCustomerRow({
      id: "c1",
      clinic_id: "clinic1",
      full_name: "דנה כהן",
      phone: null,
      email: null,
      address: null,
      preferred_contact_method: "phone",
      notes: null,
      status: "active",
      tags: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });
    expect(customer.tags).toEqual([]);
  });

  it("passes through a populated tags column", () => {
    const customer = mapCustomerRow({
      id: "c1",
      clinic_id: "clinic1",
      full_name: "דנה כהן",
      phone: null,
      email: null,
      address: null,
      preferred_contact_method: "phone",
      notes: null,
      status: "active",
      tags: ["VIP"],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });
    expect(customer.tags).toEqual(["VIP"]);
  });
});

describe("CustomerRepository tags passthrough", () => {
  it("insert() defaults tags to an empty array when none are given", async () => {
    const query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "c1",
          clinic_id: "clinic1",
          full_name: "דנה כהן",
          phone: null,
          email: null,
          address: null,
          preferred_contact_method: "phone",
          notes: null,
          status: "active",
          tags: [],
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          deleted_at: null,
        },
        error: null,
      }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new CustomerRepository(client as never);

    await repository.insert({ clinicId: "clinic1", fullName: "דנה כהן" });

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
  });

  it("insert() carries the given tags through", async () => {
    const query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "c1", tags: ["VIP"] }, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new CustomerRepository(client as never);

    await repository.insert({ clinicId: "clinic1", fullName: "דנה כהן", tags: ["VIP"] });

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ tags: ["VIP"] }));
  });

  it("update() passes tags through to the patch payload", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "c1", tags: ["VIP", "בעל 2 חתולים"] }, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new CustomerRepository(client as never);

    await repository.update("c1", { tags: ["VIP", "בעל 2 חתולים"] });

    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ tags: ["VIP", "בעל 2 חתולים"] }));
  });
});
