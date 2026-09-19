import { describe, expect, it, vi } from "vitest";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { postgrestOrIlikeValue } from "@/lib/search/escape-postgrest";

describe("customer and pet list search filters", () => {
  it("passes escaped PostgREST ilike values into customer .or()", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new CustomerRepository(client as never);
    const raw = "dana, (or).100%";

    const result = await repository.list({ clinicIds: ["clinic1"], query: raw });

    expect(result.ok).toBe(true);
    const value = postgrestOrIlikeValue(raw);
    expect(query.or).toHaveBeenCalledWith(
      `full_name.ilike.${value},phone.ilike.${value},email.ilike.${value}`,
    );
    expect(query.or.mock.calls[0]?.[0]).not.toContain(`${raw}`);
    expect(query.or.mock.calls[0]?.[0]).toContain('"');
  });

  it("passes escaped PostgREST ilike values into pet .or()", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new PetRepository(client as never);
    const raw = "rex_1,cat";

    const result = await repository.list({ clinicIds: ["clinic1"], query: raw });

    expect(result.ok).toBe(true);
    const value = postgrestOrIlikeValue(raw);
    expect(query.or).toHaveBeenCalledWith(
      `name.ilike.${value},species.ilike.${value},chip_number.ilike.${value}`,
    );
  });
});
