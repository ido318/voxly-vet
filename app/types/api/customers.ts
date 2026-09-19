import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

export type CustomerListResponse = {
  items: Customer[];
};

export type CustomerDetailResponse = {
  customer: Customer;
  pets: Pet[];
};

export type PetDetailResponse = {
  pet: Pet;
};

export type SearchResponse = {
  customers: Customer[];
  pets: Pet[];
};
