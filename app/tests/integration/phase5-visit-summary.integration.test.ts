import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStubVisitSummaryProvider } from "@/lib/ai/visit-summary/provider";
import { AIEventRepository } from "@/lib/repositories/ai-event.repository";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { AIEventService } from "@/lib/services/ai-event.service";
import { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";
import { VisitSummaryAssistantService } from "@/lib/services/visit-summary-assistant.service";
import { VisitService } from "@/lib/services/visit.service";
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

function assertSafeAiEventPayload(payload: Record<string, unknown> | null) {
  expect(payload).toBeTruthy();
  const serialized = JSON.stringify(payload);
  expect(payload).not.toHaveProperty("preview");
  expect(payload).not.toHaveProperty("draftText");
  expect(payload).not.toHaveProperty("content");
  expect(serialized).not.toContain("Mild lameness on left hind");
  expect(serialized).not.toContain("Integration stub visit summary");
}

describe.runIf(runIntegration)("phase5 visit summary assistant", () => {
  let ownerClient: TestSupabaseClient;
  let adminClient: TestSupabaseClient;
  let ownerUserId = "";
  let staffUserId = "";
  let actor: ServiceActor;
  let staffActor: ServiceActor;
  const createdCustomerIds: string[] = [];
  const createdPetIds: string[] = [];
  const createdVisitIds: string[] = [];
  const createdNoteIds: string[] = [];
  const createdAiEventIds: string[] = [];

  beforeAll(async () => {
    adminClient = createTestSupabaseClient(supabaseUrl!, serviceRoleKey!);
    ownerClient = createTestSupabaseClient(supabaseUrl!, anonKey!);

    const ownerLogin = await ownerClient.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    if (ownerLogin.error || !ownerLogin.data.user) {
      throw new Error(`Owner login failed: ${ownerLogin.error?.message}`);
    }
    ownerUserId = ownerLogin.data.user.id;
    actor = {
      userId: ownerUserId,
      clinicIds: [clinic1],
      defaultClinicId: clinic1,
      memberships: [{ clinicId: clinic1, role: "owner" }],
    };

    const staffEmail = `phase5-staff-${Date.now()}@demo-clinic.local`;
    const created = await adminClient.auth.admin.createUser({
      email: staffEmail,
      password: "phase5-staff-password",
      email_confirm: true,
    });
    if (!created.data.user) throw new Error("Could not create staff user");
    staffUserId = created.data.user.id;

    await adminClient.from("profiles").upsert({
      id: staffUserId,
      full_name: "Phase5 Staff",
      default_clinic_id: clinic1,
    });
    await adminClient.from("clinic_memberships").upsert(
      {
        clinic_id: clinic1,
        user_id: staffUserId,
        role: "staff",
      },
      { onConflict: "clinic_id,user_id" },
    );

    staffActor = {
      userId: staffUserId,
      clinicIds: [clinic1],
      defaultClinicId: clinic1,
      memberships: [{ clinicId: clinic1, role: "staff" }],
    };
  });

  afterAll(async () => {
    if (createdAiEventIds.length > 0) {
      await adminClient.from("ai_events").delete().in("id", createdAiEventIds);
    }
    if (createdNoteIds.length > 0) {
      await adminClient.from("medical_notes").delete().in("id", createdNoteIds);
    }
    if (createdVisitIds.length > 0) {
      await adminClient.from("visits").delete().in("id", createdVisitIds);
    }
    if (createdPetIds.length > 0) {
      await adminClient.from("pets").delete().in("id", createdPetIds);
    }
    if (createdCustomerIds.length > 0) {
      await adminClient.from("customers").delete().in("id", createdCustomerIds);
    }
    if (staffUserId) {
      await adminClient.from("clinic_memberships").delete().eq("user_id", staffUserId);
      await adminClient.from("profiles").delete().eq("id", staffUserId);
      await adminClient.auth.admin.deleteUser(staffUserId);
    }
    await ownerClient.auth.signOut();
  });

  function buildAssistant() {
    const visitRepository = new VisitRepository(ownerClient);
    const medicalNoteRepository = new MedicalNoteRepository(ownerClient);
    const prescriptionRepository = new PrescriptionRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);
    const auditService = new AuditService(new AuditLogRepository(adminClient));
    const aiEventService = new AIEventService(new AIEventRepository(adminClient));

    return new VisitSummaryAssistantService(
      visitRepository,
      medicalNoteRepository,
      prescriptionRepository,
      petRepository,
      auditService,
      aiEventService,
      createStubVisitSummaryProvider("Integration stub visit summary."),
    );
  }

  async function createVisitWithNote() {
    const customerRepository = new CustomerRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);
    const visitRepository = new VisitRepository(ownerClient);
    const medicalNoteRepository = new MedicalNoteRepository(ownerClient);
    const auditService = new AuditService(new AuditLogRepository(adminClient));
    const visitService = new VisitService(
      visitRepository,
      customerRepository,
      petRepository,
      new AppointmentRepository(ownerClient),
      auditService,
    );

    const customer = await customerRepository.insert({
      clinicId: clinic1,
      fullName: `Phase5 Customer ${Date.now()}`,
      preferredContactMethod: "phone",
      status: "active",
    });
    expect(customer.ok).toBe(true);
    if (!customer.ok) throw new Error("customer");
    createdCustomerIds.push(customer.value.id);

    const pet = await petRepository.insert({
      clinicId: clinic1,
      customerId: customer.value.id,
      name: "Phase5 Pet",
      species: "dog",
      status: "active",
    });
    expect(pet.ok).toBe(true);
    if (!pet.ok) throw new Error("pet");
    createdPetIds.push(pet.value.id);

    const visit = await visitService.createVisit(actor, {
      clinicId: clinic1,
      customerId: customer.value.id,
      petId: pet.value.id,
      chiefComplaint: "Limping",
    });
    expect(visit.ok).toBe(true);
    if (!visit.ok) throw new Error("visit");
    createdVisitIds.push(visit.value.id);

    const note = await medicalNoteRepository.create(
      clinic1,
      visit.value.id,
      { noteType: "general", content: "Mild lameness on left hind." },
      ownerUserId,
    );
    expect(note.ok).toBe(true);
    if (note.ok) createdNoteIds.push(note.value.id);

    return { visitService, visit: visit.value };
  }

  it("generates draft with safe ai_event, accepts with audit payloads and version", async () => {
    const assistant = buildAssistant();
    const { visitService, visit } = await createVisitWithNote();

    const generate = await assistant.generateDraft(actor, visit.id);
    expect(generate.ok).toBe(true);
    if (!generate.ok) return;
    createdAiEventIds.push(generate.value.aiEventId);

    const { data: aiEvent } = await adminClient
      .from("ai_events")
      .select("input_payload, output_payload")
      .eq("id", generate.value.aiEventId)
      .single();
    assertSafeAiEventPayload(
      (aiEvent?.output_payload as Record<string, unknown> | null) ?? null,
    );
    assertSafeAiEventPayload(
      (aiEvent?.input_payload as Record<string, unknown> | null) ?? null,
    );
    expect(aiEvent?.output_payload).toMatchObject({
      outputLength: expect.any(Number),
      modelName: "stub",
      noteCount: 1,
    });

    const staffGenerate = await assistant.generateDraft(staffActor, visit.id);
    expect(staffGenerate.ok).toBe(false);
    if (!staffGenerate.ok) expect(staffGenerate.error.status).toBe(403);

    const accept = await assistant.acceptDraft(
      actor,
      visit.id,
      visit.version,
      generate.value.draftText,
    );
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;

    const { data: auditRow } = await adminClient
      .from("audit_logs")
      .select("before_payload, after_payload")
      .eq("entity_id", visit.id)
      .eq("action", "ai_visit_summary_accepted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(auditRow?.before_payload).toEqual({ ai_visit_summary: null });
    expect(auditRow?.after_payload).toMatchObject({
      ai_visit_summary: generate.value.draftText,
      ai_summary_accepted_by_user_id: ownerUserId,
    });

    const staleAccept = await assistant.acceptDraft(
      actor,
      visit.id,
      visit.version,
      "Should conflict",
    );
    expect(staleAccept.ok).toBe(false);
    if (!staleAccept.ok) expect(staleAccept.error.status).toBe(409);

    const cancelled = await visitService.changeVisitStatus(
      actor,
      visit.id,
      accept.value.version,
      { status: "cancelled" },
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;

    const generateCancelled = await assistant.generateDraft(actor, visit.id);
    expect(generateCancelled.ok).toBe(false);
    if (!generateCancelled.ok) {
      expect(generateCancelled.error.status).toBe(400);
    }

    const acceptCancelled = await assistant.acceptDraft(
      actor,
      visit.id,
      cancelled.value.version,
      "Should not accept",
    );
    expect(acceptCancelled.ok).toBe(false);
    if (!acceptCancelled.ok) {
      expect(acceptCancelled.error.status).toBe(400);
    }
  });

  it("staff cannot accept AI summary", async () => {
    const assistant = buildAssistant();
    const { visit } = await createVisitWithNote();

    const generate = await assistant.generateDraft(actor, visit.id);
    expect(generate.ok).toBe(true);
    if (!generate.ok) return;
    createdAiEventIds.push(generate.value.aiEventId);

    const staffAccept = await assistant.acceptDraft(
      staffActor,
      visit.id,
      visit.version,
      generate.value.draftText,
    );
    expect(staffAccept.ok).toBe(false);
    if (!staffAccept.ok) expect(staffAccept.error.status).toBe(403);
  });
});
