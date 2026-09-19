import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import { MedicalRecordRepository } from "@/lib/repositories/medical-record.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import { VaccinationRepository } from "@/lib/repositories/vaccination.repository";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { AuditService } from "@/lib/services/audit.service";
import { MedicalRecordService } from "@/lib/services/medical-record.service";
import { PetService } from "@/lib/services/pet.service";
import { VisitService } from "@/lib/services/visit.service";
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
const clinicId = "00000000-0000-4000-8000-000000000001";

describe.runIf(runIntegration)("phase1 database core alignment", () => {
  let ownerClient: TestSupabaseClient;
  let adminClient: TestSupabaseClient;
  let actor: ServiceActor;
  const createdCustomerIds: string[] = [];
  const createdPetIds: string[] = [];
  const createdVisitIds: string[] = [];
  const createdNoteIds: string[] = [];
  const createdMedicalRecordIds: string[] = [];

  beforeAll(async () => {
    ownerClient = createTestSupabaseClient(supabaseUrl!, anonKey!);
    adminClient = createTestSupabaseClient(supabaseUrl!, serviceRoleKey!);

    const ownerLogin = await ownerClient.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    if (ownerLogin.error || !ownerLogin.data.user) {
      throw new Error(`Owner login failed: ${ownerLogin.error?.message}`);
    }

    actor = {
      userId: ownerLogin.data.user.id,
      clinicIds: [clinicId],
      defaultClinicId: clinicId,
      memberships: [{ clinicId, role: "owner" }],
    };
  });

  afterAll(async () => {
    if (createdNoteIds.length > 0) {
      await adminClient.from("medical_notes").delete().in("id", createdNoteIds);
    }
    if (createdVisitIds.length > 0) {
      await adminClient.from("visits").delete().in("id", createdVisitIds);
    }
    if (createdMedicalRecordIds.length > 0) {
      await adminClient.from("medical_records").delete().in("id", createdMedicalRecordIds);
    }
    if (createdPetIds.length > 0) {
      await adminClient.from("pets").delete().in("id", createdPetIds);
    }
    if (createdCustomerIds.length > 0) {
      await adminClient.from("customers").delete().in("id", createdCustomerIds);
    }
    await adminClient
      .from("audit_logs")
      .delete()
      .in("action", ["pet.create", "medical_record.create", "visit.create", "medical_note.create"]);
    await ownerClient.auth.signOut();
  });

  it("ensures pet records, visit record links, and SOAP note fields", async () => {
    const customerRepository = new CustomerRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);
    const visitRepository = new VisitRepository(ownerClient);
    const medicalNoteRepository = new MedicalNoteRepository(ownerClient);
    const medicalRecordRepository = new MedicalRecordRepository(ownerClient);
    const auditService = new AuditService(new AuditLogRepository(adminClient));
    const medicalRecordService = new MedicalRecordService(
      visitRepository,
      medicalNoteRepository,
      new VaccinationRepository(ownerClient),
      new PrescriptionRepository(ownerClient),
      petRepository,
      auditService,
      medicalRecordRepository,
    );
    const petService = new PetService(
      petRepository,
      customerRepository,
      auditService,
      medicalRecordService,
    );
    const visitService = new VisitService(
      visitRepository,
      customerRepository,
      petRepository,
      new AppointmentRepository(ownerClient),
      auditService,
      medicalRecordService,
    );

    const customer = await customerRepository.insert({
      clinicId,
      fullName: `Phase1 Customer ${Date.now()}`,
      preferredContactMethod: "phone",
      status: "active",
    });
    expect(customer.ok).toBe(true);
    if (!customer.ok) return;
    createdCustomerIds.push(customer.value.id);

    const pet = await petService.createPet(actor, {
      clinicId,
      customerId: customer.value.id,
      name: "Luna",
      species: "cat",
      status: "active",
    });
    expect(pet.ok).toBe(true);
    if (!pet.ok) return;
    createdPetIds.push(pet.value.id);

    const record = await medicalRecordRepository.findByPet(clinicId, pet.value.id);
    expect(record.ok).toBe(true);
    expect(record.ok ? record.value?.petId : null).toBe(pet.value.id);
    if (!record.ok || !record.value) return;
    createdMedicalRecordIds.push(record.value.id);

    const visit = await visitService.createVisit(actor, {
      clinicId,
      customerId: customer.value.id,
      petId: pet.value.id,
      chiefComplaint: "Coughing",
    });
    expect(visit.ok).toBe(true);
    if (!visit.ok) return;
    createdVisitIds.push(visit.value.id);
    expect(visit.value.medicalRecordId).toBe(record.value.id);

    const note = await medicalRecordService.addNote(actor, visit.value.id, {
      noteType: "general",
      content: "SOAP draft exists in structured fields.",
      subjective: "Owner reports coughing.",
      objective: "No fever.",
      assessment: "Mild respiratory concern.",
      plan: "Monitor and recheck if worse.",
    });
    expect(note.ok).toBe(true);
    if (!note.ok) return;
    createdNoteIds.push(note.value.id);
    expect(note.value.content).toBe("SOAP draft exists in structured fields.");
    expect(note.value.subjective).toBe("Owner reports coughing.");
    expect(note.value.objective).toBe("No fever.");
    expect(note.value.assessment).toBe("Mild respiratory concern.");
    expect(note.value.plan).toBe("Monitor and recheck if worse.");
    expect(note.value.status).toBe("draft");
  });
});
