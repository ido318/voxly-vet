import { describe, it, expect } from "vitest";
import { formatSearchResults } from "@/lib/search/format-search-results";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    clinicId: "clinic-1",
    fullName: "דנה כהן",
    phone: "+972501234567",
    email: null,
    address: null,
    preferredContactMethod: "phone",
    notes: null,
    status: "active",
    tags: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: null,
    ...overrides,
  };
}

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: "pet-1",
    clinicId: "clinic-1",
    customerId: "cust-1",
    name: "רקס",
    species: "כלב",
    breed: null,
    sex: null,
    birthDate: null,
    weight: null,
    chipNumber: null,
    isNeutered: false,
    allergies: null,
    chronicConditions: null,
    currentMedications: null,
    notes: null,
    profileImageUrl: null,
    status: "active",
    ...overrides,
  } as Pet;
}

describe("formatSearchResults", () => {
  it("returns a customer row with the customer's own id as the target customerId", () => {
    const rows = formatSearchResults([makeCustomer()], []);
    expect(rows).toEqual([
      { kind: "customer", id: "cust-1", customerId: "cust-1", title: "דנה כהן", subtitle: "+972501234567" },
    ]);
  });

  it("returns a pet row that links back to the pet's owner via customerId", () => {
    const rows = formatSearchResults([], [makePet()]);
    expect(rows).toEqual([
      { kind: "pet", id: "pet-1", customerId: "cust-1", title: "רקס", subtitle: "כלב" },
    ]);
  });

  it("puts customers before pets and caps the combined list at 8", () => {
    const customers = Array.from({ length: 5 }, (_, i) => makeCustomer({ id: `c${i}`, fullName: `לקוח ${i}` }));
    const pets = Array.from({ length: 5 }, (_, i) => makePet({ id: `p${i}`, name: `חיה ${i}` }));
    const rows = formatSearchResults(customers, pets);
    expect(rows).toHaveLength(8);
    expect(rows.slice(0, 5).every((r) => r.kind === "customer")).toBe(true);
    expect(rows.slice(5).every((r) => r.kind === "pet")).toBe(true);
  });
});
