import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { InvoiceRepository } from "@/lib/repositories/invoice.repository";
import { AuditService } from "@/lib/services/audit.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import type { ServiceActor } from "@/lib/services/service-context";
import {
  createTestSupabaseClient,
  type TestSupabaseClient,
} from "@/tests/support/supabase-test-client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  Boolean(supabaseUrl && anonKey && serviceRoleKey);

const ownerEmail = process.env.DEV_USER_EMAIL ?? "owner@demo-clinic.local";
const ownerPassword = process.env.DEV_USER_PASSWORD ?? "dev-password-change-me";
const clinic1 = "00000000-0000-4000-8000-000000000001";

// M10: invoice numbering used to be "count(*) + 1" in app code, then a
// separate insert — two concurrent createInvoice calls for the same clinic
// could compute the same number and collide on invoices_clinic_number_unique.
// The create_invoice RPC (20260903020000) makes numbering-and-insert one
// atomic operation, using a per-clinic-year counter row bumped via
// "insert ... on conflict ... do update" instead of a bare count(*); this
// proves concurrent callers each get a distinct number instead of erroring.
describe.runIf(runIntegration)("invoice atomic numbering", () => {
  let ownerClient: TestSupabaseClient;
  let adminClient: TestSupabaseClient;
  let ownerUserId = "";
  let customerId = "";
  const createdInvoiceIds: string[] = [];

  beforeAll(async () => {
    adminClient = createTestSupabaseClient(supabaseUrl!, serviceRoleKey!);
    ownerClient = createTestSupabaseClient(supabaseUrl!, anonKey!);

    const ownerLogin = await ownerClient.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    if (ownerLogin.error || !ownerLogin.data.user) {
      throw new Error(`Failed to login owner user: ${ownerLogin.error?.message}`);
    }
    ownerUserId = ownerLogin.data.user.id;

    const customer = await adminClient
      .from("customers")
      .insert({ clinic_id: clinic1, full_name: "לקוח בדיקת חשבוניות" })
      .select("id")
      .single();
    if (customer.error || !customer.data) {
      throw new Error(`Failed to create test customer: ${customer.error?.message}`);
    }
    customerId = customer.data.id as string;
  });

  afterAll(async () => {
    if (createdInvoiceIds.length > 0) {
      await adminClient.from("invoices").delete().in("id", createdInvoiceIds);
    }
    if (customerId) {
      await adminClient.from("customers").delete().eq("id", customerId);
    }
  });

  it("gives concurrent createInvoice calls for the same clinic distinct invoice numbers", async () => {
    const auditService = new AuditService(new AuditLogRepository(ownerClient));
    const invoiceService = new InvoiceService(new InvoiceRepository(ownerClient), auditService);

    const actor: ServiceActor = {
      userId: ownerUserId,
      clinicIds: [clinic1],
      defaultClinicId: clinic1,
      memberships: [{ clinicId: clinic1, role: "owner" }],
    };

    const CONCURRENT = 5;
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        invoiceService.createInvoice(actor, {
          clinicId: clinic1,
          customerId,
          petId: null,
          items: [{ description: "בדיקה", quantity: 1, unitPrice: 100 }],
          notes: null,
        }),
      ),
    );

    for (const result of results) {
      if (!result.ok) {
        throw new Error(`createInvoice failed: ${JSON.stringify(result.error)}`);
      }
      createdInvoiceIds.push(result.value.id);
    }

    const invoiceNumbers = results.map((r) => (r.ok ? r.value.invoiceNumber : null));
    expect(new Set(invoiceNumbers).size).toBe(CONCURRENT);
    expect(invoiceNumbers.every((n) => /^INV-\d{4}-\d{3,}$/.test(n ?? ""))).toBe(true);
  });
});
