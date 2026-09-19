import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { phonesMatch } from "@/lib/integrations/twilio/phone";
import { mapCustomerRow } from "@/lib/repositories/mappers";
import { postgrestOrIlikeValue } from "@/lib/search/escape-postgrest";
import type {
  CreateCustomerInput,
  Customer,
  CustomerDuplicate,
  CustomerListFilters,
  UpdateCustomerInput,
} from "@/types/domain/customer";

export class CustomerRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: CustomerListFilters): Promise<Result<Customer[]>> {
    const pageSize = filters.pageSize ?? 25;
    const page = filters.page ?? 1;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from("customers")
      .select("*")
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.query) {
      const value = postgrestOrIlikeValue(filters.query);
      query = query.or(`full_name.ilike.${value},phone.ilike.${value},email.ilike.${value}`);
    }

    const { data, error } = await query;
    if (error) {
      return err(AppError.externalProvider("Failed to list customers", error));
    }

    return ok((data ?? []).map(mapCustomerRow));
  }

  async findByClinicAndPhone(
    clinicId: string,
    phone: string,
  ): Promise<Result<Customer | null>> {
    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .not("phone", "is", null);

    if (error) {
      return err(AppError.externalProvider("Failed to lookup customer by phone", error));
    }

    const match = (data ?? []).find(
      (row) => row.phone && phonesMatch(row.phone, phone),
    );
    return ok(match ? mapCustomerRow(match) : null);
  }

  async findPotentialDuplicates(
    clinicId: string,
    input: { phone?: string | null; email?: string | null },
  ): Promise<Result<CustomerDuplicate[]>> {
    const phone = input.phone?.trim() || null;
    const email = input.email?.trim().toLowerCase() || null;
    if (!phone && !email) return ok([]);

    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("clinic_id", clinicId)
      .is("deleted_at", null);

    if (error) {
      return err(AppError.externalProvider("Failed to check duplicate customers", error));
    }

    const duplicates = (data ?? [])
      .map(mapCustomerRow)
      .filter((customer) => {
        const phoneMatches = Boolean(phone && customer.phone && phonesMatch(customer.phone, phone));
        const emailMatches = Boolean(
          email &&
            customer.email &&
            customer.email.trim().toLowerCase() === email,
        );
        return phoneMatches || emailMatches;
      })
      .map((customer) => ({
        id: customer.id,
        clinicId: customer.clinicId,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
      }));

    return ok(duplicates);
  }

  async findById(customerId: string): Promise<Result<Customer | null>> {
    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return err(AppError.externalProvider("Failed to load customer", error));
    }
    return ok(data ? mapCustomerRow(data) : null);
  }

  async insert(input: CreateCustomerInput): Promise<Result<Customer>> {
    const { data, error } = await this.client
      .from("customers")
      .insert({
        clinic_id: input.clinicId,
        full_name: input.fullName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        preferred_contact_method: input.preferredContactMethod ?? "phone",
        notes: input.notes ?? null,
        status: input.status ?? "active",
        tags: input.tags ?? [],
      })
      .select("*")
      .single();

    if (error) {
      return err(AppError.externalProvider("Failed to create customer", error));
    }
    return ok(mapCustomerRow(data));
  }

  async update(customerId: string, input: UpdateCustomerInput): Promise<Result<Customer>> {
    const { data, error } = await this.client
      .from("customers")
      .update({
        clinic_id: input.clinicId,
        full_name: input.fullName,
        phone: input.phone,
        email: input.email,
        address: input.address,
        preferred_contact_method: input.preferredContactMethod,
        notes: input.notes,
        status: input.status,
        tags: input.tags,
      })
      .eq("id", customerId)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      return err(AppError.externalProvider("Failed to update customer", error));
    }
    return ok(mapCustomerRow(data));
  }

  async softDelete(customerId: string): Promise<Result<void>> {
    const { error } = await this.client
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", customerId)
      .is("deleted_at", null);

    if (error) {
      return err(AppError.externalProvider("Failed to delete customer", error));
    }
    return ok(undefined);
  }
}
