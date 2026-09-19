export type PaymentMethod = "cash" | "card" | "bank_transfer" | "bit" | "other";

export type Payment = {
  id: string;
  clinicId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  recordedByUserId: string | null;
  createdAt: string;
};

export type RecordPaymentInput = {
  invoiceId: string;
  clinicId?: string;
  amount: number;
  method: PaymentMethod;
  paidAt?: string;
  reference?: string | null;
  notes?: string | null;
};
