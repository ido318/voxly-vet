import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

export type SearchResultRow = {
  kind: "customer" | "pet";
  id: string;
  customerId: string;
  title: string;
  subtitle: string;
};

const MAX_RESULTS = 8;

export function formatSearchResults(customers: Customer[], pets: Pet[]): SearchResultRow[] {
  const customerRows: SearchResultRow[] = customers.map((c) => ({
    kind: "customer",
    id: c.id,
    customerId: c.id,
    title: c.fullName,
    subtitle: c.phone ?? c.email ?? "",
  }));

  const petRows: SearchResultRow[] = pets.map((p) => ({
    kind: "pet",
    id: p.id,
    customerId: p.customerId,
    title: p.name,
    subtitle: p.species,
  }));

  return [...customerRows, ...petRows].slice(0, MAX_RESULTS);
}
