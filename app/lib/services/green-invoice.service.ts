import { createInvoiceDocument } from "@/lib/integrations/green-invoice/client";
import type { Customer } from "@/types/domain/customer";
import type { InvoiceLineItem } from "@/types/domain/invoice";

export type PaymentDocument = {
  documentId: string;
  paymentUrl: string;
};

export class GreenInvoiceService {
  async createPaymentDocument(
    customer: Customer,
    items: InvoiceLineItem[],
    notes?: string | null,
  ): Promise<PaymentDocument> {
    const document = await createInvoiceDocument({
      client: {
        name: customer.fullName,
        phone: customer.phone ?? undefined,
        emails: customer.email ? [customer.email] : undefined,
      },
      income: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
      })),
      remarks: notes ?? undefined,
    });

    return { documentId: document.documentId, paymentUrl: document.paymentUrl };
  }
}
