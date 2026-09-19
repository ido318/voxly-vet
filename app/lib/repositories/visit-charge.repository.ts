import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapVisitChargeRow } from "@/lib/repositories/mappers";
import type { CreateVisitChargeInput, VisitCharge } from "@/types/domain/visit-charge";

export class VisitChargeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByVisit(visitId: string): Promise<Result<VisitCharge[]>> {
    const { data, error } = await this.client
      .from("visit_charges")
      .select("*")
      .eq("visit_id", visitId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) return err(AppError.externalProvider("Failed to list visit charges", error));
    return ok((data ?? []).map(mapVisitChargeRow));
  }

  async create(input: CreateVisitChargeInput & {
    clinicId: string;
    visitId: string;
    customerId: string;
    petId: string;
    createdByUserId: string;
  }): Promise<Result<VisitCharge>> {
    const { data, error } = await this.client
      .from("visit_charges")
      .insert({
        clinic_id: input.clinicId,
        visit_id: input.visitId,
        customer_id: input.customerId,
        pet_id: input.petId,
        description: input.description,
        quantity: input.quantity,
        unit_price: input.unitPrice,
        source_type: input.sourceType ?? "manual",
        source_id: input.sourceId ?? null,
        created_by_user_id: input.createdByUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create visit charge", error));
    return ok(mapVisitChargeRow(data));
  }

  async review(chargeId: string, reviewerUserId: string, clinicIds: string[]): Promise<Result<VisitCharge>> {
    const { data, error } = await this.client
      .from("visit_charges")
      .update({
        status: "reviewed",
        reviewed_by_user_id: reviewerUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", chargeId)
      .eq("status", "pending")
      .in("clinic_id", clinicIds)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to review visit charge", error));
    if (!data) return err(AppError.conflict("Visit charge is not pending review"));
    return ok(mapVisitChargeRow(data));
  }

  async markInvoiced(
    chargeIds: string[],
    invoiceId: string,
    clinicId: string,
  ): Promise<Result<void>> {
    if (chargeIds.length === 0) return ok(undefined);
    const { data, error } = await this.client
      .from("visit_charges")
      .update({ status: "invoiced", invoice_id: invoiceId })
      .in("id", chargeIds)
      .eq("clinic_id", clinicId)
      .eq("status", "reviewed")
      .is("deleted_at", null)
      .select("id");
    if (error) return err(AppError.externalProvider("Failed to mark charges invoiced", error));
    if ((data ?? []).length !== chargeIds.length) {
      return err(AppError.conflict("Some charges were not in reviewed status"));
    }
    return ok(undefined);
  }

  async createInvoiceFromVisit(input: {
    visitId: string;
    notes: string | null;
    createdByUserId: string;
  }): Promise<Result<{ id: string }>> {
    const { data, error } = await this.client.rpc("create_invoice_from_visit", {
      p_visit_id: input.visitId,
      p_notes: input.notes,
      p_created_by_user_id: input.createdByUserId,
    });
    if (error) {
      const message = error.message ?? "";
      if (message.includes("pending charges remain")) {
        return err(AppError.validation("All pending charges must be reviewed before invoice creation"));
      }
      if (message.includes("no reviewed charges")) {
        return err(AppError.validation("At least one reviewed charge is required before invoice creation"));
      }
      if (message.includes("visit not found")) {
        return err(AppError.notFound("Visit not found"));
      }
      if ((error as { code?: string }).code === "23505") {
        return err(AppError.conflict("Invoice number was just taken — retry", error));
      }
      return err(AppError.externalProvider("Failed to create invoice from visit", error));
    }
    return ok({ id: (data as { id: string }).id });
  }
}
