export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  clinicId: string;
  customerId: string;
  customerName?: string | null;
  petId: string | null;
  petName?: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  issuedAt: string;
  items: InvoiceLineItem[];
  total: number;
  notes: string | null;
  paymentLinkUrl: string | null;
  greenInvoiceDocumentId: string | null;
  paymentLinkSentAt: string | null;
  createdByUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateInvoiceInput = {
  clinicId: string;
  customerId: string;
  petId?: string | null;
  items: InvoiceLineItem[];
  notes?: string | null;
};

export type UpdateInvoiceStatusInput = {
  version: number;
  status: InvoiceStatus;
};

export type InvoiceListFilters = {
  clinicIds: string[];
  customerId?: string;
  petId?: string;
};
