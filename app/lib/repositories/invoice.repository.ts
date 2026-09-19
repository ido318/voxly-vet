import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapInvoiceRow } from "@/lib/repositories/mappers";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceListFilters,
} from "@/types/domain/invoice";

type InsertInvoiceInput = {
  clinicId: string;
  customerId: string;
  petId: string | null;
  items: InvoiceLineItem[];
  total: number;
  notes: string | null;
  createdByUserId: string;
};

const SELECT_WITH_JOINS = `
  *,
  customer:customers!invoices_customer_clinic_fk(full_name),
  pet:pets!invoices_pet_clinic_fk(name)
`;

export class InvoiceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: InvoiceListFilters): Promise<Result<Invoice[]>> {
    let query = this.client
      .from("invoices")
      .select(SELECT_WITH_JOINS)
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("issued_at", { ascending: false });

    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.petId) query = query.eq("pet_id", filters.petId);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list invoices", error));
    return ok((data ?? []).map(mapInvoiceRow));
  }

  async findById(invoiceId: string): Promise<Result<Invoice | null>> {
    const { data, error } = await this.client
      .from("invoices")
      .select(SELECT_WITH_JOINS)
      .eq("id", invoiceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load invoice", error));
    return ok(data ? mapInvoiceRow(data) : null);
  }

  /**
   * Invoice numbering and the insert happen atomically in one DB transaction
   * (the create_invoice RPC, 20260903020000) — a plain app-level "count + 1
   * then insert" let two concurrent calls for the same clinic compute the
   * same invoice_number and collide on invoices_clinic_number_unique.
   */
  async create(input: InsertInvoiceInput): Promise<Result<Invoice>> {
    const { data: created, error } = await this.client.rpc("create_invoice", {
      p_clinic_id: input.clinicId,
      p_customer_id: input.customerId,
      p_pet_id: input.petId,
      p_items: input.items,
      p_total: input.total,
      p_notes: input.notes,
      p_created_by_user_id: input.createdByUserId,
    });

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return err(AppError.conflict("Invoice number was just taken — retry", error));
      }
      return err(AppError.externalProvider("Failed to create invoice", error));
    }

    // The RPC returns the bare row; re-fetch with the customer/pet name joins
    // the rest of the API surface expects.
    const invoiceId = (created as { id: string }).id;
    const withJoins = await this.findById(invoiceId);
    if (!withJoins.ok) return withJoins;
    if (!withJoins.value) {
      return err(AppError.externalProvider("Invoice created but could not be re-fetched", { invoiceId }));
    }
    return ok(withJoins.value);
  }

  async updateStatusVersioned(
    invoiceId: string,
    expectedVersion: number,
    status: string,
  ): Promise<Result<Invoice>> {
    const { data, error } = await this.client
      .from("invoices")
      .update({ status, version: expectedVersion + 1 })
      .eq("id", invoiceId)
      .eq("version", expectedVersion)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(
          AppError.conflict("Invoice update conflict: stale version", {
            invoiceId,
            expectedVersion,
          }),
        );
      }
      return err(AppError.externalProvider("Failed to update invoice status", error));
    }
    return ok(mapInvoiceRow(data));
  }

  async attachPaymentLink(
    invoiceId: string,
    input: { paymentLinkUrl: string; greenInvoiceDocumentId: string },
  ): Promise<Result<Invoice>> {
    const { data, error } = await this.client
      .from("invoices")
      .update({
        payment_link_url: input.paymentLinkUrl,
        green_invoice_document_id: input.greenInvoiceDocumentId,
      })
      .eq("id", invoiceId)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) return err(AppError.externalProvider("Failed to attach payment link", error));
    return ok(mapInvoiceRow(data));
  }

  async claimPaymentLinkSend(invoiceId: string): Promise<Result<Invoice | null>> {
    const { data, error } = await this.client
      .from("invoices")
      .update({ payment_link_sent_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("status", "sent")
      .is("payment_link_sent_at", null)
      .select(SELECT_WITH_JOINS)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to claim payment link send", error));
    return ok(data ? mapInvoiceRow(data) : null);
  }

  async releasePaymentLinkClaim(invoiceId: string): Promise<Result<void>> {
    const { error } = await this.client
      .from("invoices")
      .update({
        payment_link_sent_at: null,
        payment_link_url: null,
        green_invoice_document_id: null,
      })
      .eq("id", invoiceId)
      .is("payment_link_url", null);

    if (error) return err(AppError.externalProvider("Failed to release payment link claim", error));
    return ok(undefined);
  }
}
