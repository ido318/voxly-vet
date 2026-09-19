import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapPaymentRow } from "@/lib/repositories/mappers";
import type { Payment, RecordPaymentInput } from "@/types/domain/payment";

export class PaymentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async record(input: Omit<RecordPaymentInput, "clinicId"> & { clinicId: string; recordedByUserId: string }): Promise<Result<Payment>> {
    const { data, error } = await this.client
      .from("payments")
      .insert({
        clinic_id: input.clinicId,
        invoice_id: input.invoiceId,
        amount: input.amount,
        method: input.method,
        paid_at: input.paidAt ?? new Date().toISOString(),
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        recorded_by_user_id: input.recordedByUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to record payment", error));
    return ok(mapPaymentRow(data));
  }
}
