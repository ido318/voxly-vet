import { AppError, err, type Result } from "@/lib/errors/app-error";
import type { InvoiceRepository } from "@/lib/repositories/invoice.repository";
import type { PaymentRepository } from "@/lib/repositories/payment.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Payment, RecordPaymentInput } from "@/types/domain/payment";

export class PaymentService {
  constructor(
    private readonly repository: PaymentRepository,
    private readonly invoiceRepository: InvoiceRepository,
  ) {}

  async recordPayment(actor: ServiceActor, input: RecordPaymentInput): Promise<Result<Payment>> {
    const invoice = await this.invoiceRepository.findById(input.invoiceId);
    if (!invoice.ok) return invoice;
    if (!invoice.value) return err(AppError.notFound("Invoice not found"));
    if (!actor.clinicIds.includes(invoice.value.clinicId)) {
      return err(AppError.forbidden("Invoice outside actor clinics"));
    }
    if (input.clinicId && input.clinicId !== invoice.value.clinicId) {
      return err(AppError.validation("Payment clinic does not match invoice clinic"));
    }

    return this.repository.record({
      ...input,
      clinicId: invoice.value.clinicId,
      recordedByUserId: actor.userId,
    });
  }
}
