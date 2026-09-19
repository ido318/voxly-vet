import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import { VaccinationRepository } from "@/lib/repositories/vaccination.repository";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { AppointmentService } from "@/lib/services/appointment.service";
import { AuditService } from "@/lib/services/audit.service";
import { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { ServiceActor } from "@/lib/services/service-context";
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
const clinic2 = "00000000-0000-4000-8000-000000000002";

describe.runIf(runIntegration)("phase4 medical records", () => {
  let ownerClient: TestSupabaseClient;
  let otherClient: TestSupabaseClient;
  let adminClient: TestSupabaseClient;
  let ownerUserId = "";
  let otherUserId = "";
  let actor: ServiceActor;
  const createdCustomerIds: string[] = [];
  const createdPetIds: string[] = [];
  const createdAppointmentIds: string[] = [];
  const createdVisitIds: string[] = [];
  const createdNoteIds: string[] = [];
  const createdVaccinationIds: string[] = [];
  const createdPrescriptionIds: string[] = [];

  beforeAll(async () => {
    adminClient = createTestSupabaseClient(supabaseUrl!, serviceRoleKey!);
    ownerClient = createTestSupabaseClient(supabaseUrl!, anonKey!);
    otherClient = createTestSupabaseClient(supabaseUrl!, anonKey!);

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

    await adminClient
      .from("clinics")
      .upsert({ id: clinic2, name: "Clinic Two", slug: "clinic-two", timezone: "Asia/Jerusalem" });

    const otherEmail = `phase4-other-${Date.now()}@demo-clinic.local`;
    const created = await adminClient.auth.admin.createUser({
      email: otherEmail,
      password: "phase4-test-password",
      email_confirm: true,
      user_metadata: { full_name: "Phase4 Other User" },
    });
    if (!created.data.user) throw new Error("Could not create second clinic user");
    otherUserId = created.data.user.id;

    await adminClient.from("profiles").upsert({
      id: otherUserId,
      full_name: "Phase4 Other User",
      default_clinic_id: clinic2,
    });
    await adminClient.from("clinic_memberships").upsert(
      {
        clinic_id: clinic2,
        user_id: otherUserId,
        role: "owner",
      },
      { onConflict: "clinic_id,user_id" },
    );

    const otherLogin = await otherClient.auth.signInWithPassword({
      email: otherEmail,
      password: "phase4-test-password",
    });
    if (otherLogin.error) {
      throw new Error(`Other login failed: ${otherLogin.error.message}`);
    }
  });

  afterAll(async () => {
    if (createdPrescriptionIds.length > 0) {
      await adminClient.from("prescriptions").delete().in("id", createdPrescriptionIds);
    }
    if (createdVaccinationIds.length > 0) {
      await adminClient.from("vaccinations").delete().in("id", createdVaccinationIds);
    }
    if (createdNoteIds.length > 0) {
      await adminClient.from("medical_notes").delete().in("id", createdNoteIds);
    }
    if (createdVisitIds.length > 0) {
      await adminClient.from("visits").delete().in("id", createdVisitIds);
    }
    if (createdAppointmentIds.length > 0) {
      await adminClient.from("appointments").delete().in("id", createdAppointmentIds);
    }
    if (createdPetIds.length > 0) {
      await adminClient.from("pets").delete().in("id", createdPetIds);
    }
    if (createdCustomerIds.length > 0) {
      await adminClient.from("customers").delete().in("id", createdCustomerIds);
    }

    if (otherUserId) {
      await adminClient.from("clinic_memberships").delete().eq("user_id", otherUserId);
      await adminClient.from("profiles").delete().eq("id", otherUserId);
      await adminClient.auth.admin.deleteUser(otherUserId);
    }

    await ownerClient.auth.signOut();
    await otherClient.auth.signOut();
  });

  it("creates visit with audit, enforces version, appointment link, notes, vaccinations, prescriptions", async () => {
    const customerRepository = new CustomerRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);
    const appointmentRepository = new AppointmentRepository(ownerClient);
    const visitRepository = new VisitRepository(ownerClient);
    const medicalNoteRepository = new MedicalNoteRepository(ownerClient);
    const vaccinationRepository = new VaccinationRepository(ownerClient);
    const prescriptionRepository = new PrescriptionRepository(ownerClient);
    const auditService = new AuditService(new AuditLogRepository(adminClient));

    const visitService = new VisitService(
      visitRepository,
      customerRepository,
      petRepository,
      appointmentRepository,
      auditService,
    );
    const medicalRecordService = new MedicalRecordService(
      visitRepository,
      medicalNoteRepository,
      vaccinationRepository,
      prescriptionRepository,
      petRepository,
      auditService,
    );
    const appointmentService = new AppointmentService(
      appointmentRepository,
      customerRepository,
      petRepository,
      auditService,
    );

    const customer = await customerRepository.insert({
      clinicId: clinic1,
      fullName: `Phase4 Customer ${Date.now()}`,
      preferredContactMethod: "phone",
      status: "active",
    });
    expect(customer.ok).toBe(true);
    if (!customer.ok) return;
    createdCustomerIds.push(customer.value.id);

    const pet = await petRepository.insert({
      clinicId: clinic1,
      customerId: customer.value.id,
      name: "Milo",
      species: "dog",
      status: "active",
    });
    expect(pet.ok).toBe(true);
    if (!pet.ok) return;
    createdPetIds.push(pet.value.id);

    const wrongClinicVisit = await visitService.createVisit(actor, {
      clinicId: clinic2,
      customerId: customer.value.id,
      petId: pet.value.id,
    });
    expect(wrongClinicVisit.ok).toBe(false);

    const scheduledAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const appointment = await appointmentService.createAppointment(actor, {
      clinicId: clinic1,
      customerId: customer.value.id,
      petId: pet.value.id,
      appointmentType: "checkup",
      source: "front_desk",
      scheduledAt,
      durationMinutes: 40,
    });
    expect(appointment.ok).toBe(true);
    if (!appointment.ok) return;
    createdAppointmentIds.push(appointment.value.id);

    const mismatchedAppointmentVisit = await visitService.createVisit(actor, {
      clinicId: clinic1,
      customerId: customer.value.id,
      petId: pet.value.id,
      appointmentId: appointment.value.id,
    });
    expect(mismatchedAppointmentVisit.ok).toBe(true);
    if (mismatchedAppointmentVisit.ok) {
      createdVisitIds.push(mismatchedAppointmentVisit.value.id);
    }

    const otherPet = await petRepository.insert({
      clinicId: clinic1,
      customerId: customer.value.id,
      name: "Other",
      species: "cat",
      status: "active",
    });
    expect(otherPet.ok).toBe(true);
    if (!otherPet.ok) return;
    createdPetIds.push(otherPet.value.id);

    const badLink = await visitService.createVisit(actor, {
      clinicId: clinic1,
      customerId: customer.value.id,
      petId: otherPet.value.id,
      appointmentId: appointment.value.id,
    });
    expect(badLink.ok).toBe(false);

    const visit = await visitService.createVisit(actor, {
      clinicId: clinic1,
      customerId: customer.value.id,
      petId: pet.value.id,
      chiefComplaint: "Limping",
    });
    expect(visit.ok).toBe(true);
    if (!visit.ok) return;
    createdVisitIds.push(visit.value.id);

    const stale = await visitService.updateVisit(actor, visit.value.id, visit.value.version + 1, {
      chiefComplaint: "stale",
    });
    expect(stale.ok).toBe(false);

    const note = await medicalRecordService.addNote(actor, visit.value.id, {
      noteType: "general",
      content: "Patient is alert.",
    });
    expect(note.ok).toBe(true);
    if (note.ok) createdNoteIds.push(note.value.id);

    const vaccination = await medicalRecordService.recordVaccination(actor, pet.value.id, {
      clinicId: clinic1,
      customerId: customer.value.id,
      vaccineName: "DHPP",
      administeredAt: new Date().toISOString(),
      visitId: visit.value.id,
    });
    expect(vaccination.ok).toBe(true);
    if (vaccination.ok) createdVaccinationIds.push(vaccination.value.id);

    const prescription = await medicalRecordService.addPrescription(actor, visit.value.id, {
      medicationName: "Carprofen",
      instructions: "Give with food once daily.",
    });
    expect(prescription.ok).toBe(true);
    if (prescription.ok) createdPrescriptionIds.push(prescription.value.id);

    const completed = await visitService.changeVisitStatus(
      actor,
      visit.value.id,
      visit.value.version,
      { status: "completed" },
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    const deleted = await visitService.softDeleteVisit(
      actor,
      visit.value.id,
      completed.value.version,
    );
    expect(deleted.ok).toBe(true);

    const listAfterDelete = await visitRepository.list({ clinicIds: [clinic1] });
    expect(listAfterDelete.ok).toBe(true);
    if (listAfterDelete.ok) {
      expect(listAfterDelete.value.some((row) => row.id === visit.value.id)).toBe(false);
    }

    const auditRows = await adminClient
      .from("audit_logs")
      .select("action, entity_type")
      .eq("actor_id", ownerUserId)
      .in("entity_type", ["visit", "medical_note", "vaccination", "prescription"]);
    expect(auditRows.error).toBeNull();
    expect((auditRows.data ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("denies medical soft delete for staff role", async () => {
    const staffEmail = `phase4-staff-${Date.now()}@demo-clinic.local`;
    const createdStaff = await adminClient.auth.admin.createUser({
      email: staffEmail,
      password: "phase4-staff-password",
      email_confirm: true,
    });
    const staffUserId = createdStaff.data.user?.id;
    expect(staffUserId).toBeTruthy();
    if (!staffUserId) return;

    await adminClient.from("profiles").upsert({
      id: staffUserId,
      full_name: "Phase4 Staff",
      default_clinic_id: clinic1,
    });
    await adminClient.from("clinic_memberships").upsert(
      { clinic_id: clinic1, user_id: staffUserId, role: "staff" },
      { onConflict: "clinic_id,user_id" },
    );

    const customerRepository = new CustomerRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);
    const visitRepository = new VisitRepository(ownerClient);
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
      fullName: `Staff Delete Customer ${Date.now()}`,
      preferredContactMethod: "phone",
      status: "active",
    });
    expect(customer.ok).toBe(true);
    if (!customer.ok) return;
    createdCustomerIds.push(customer.value.id);

    const pet = await petRepository.insert({
      clinicId: clinic1,
      customerId: customer.value.id,
      name: "StaffPet",
      species: "dog",
      status: "active",
    });
    expect(pet.ok).toBe(true);
    if (!pet.ok) return;
    createdPetIds.push(pet.value.id);

    const visit = await visitService.createVisit(actor, {
      clinicId: clinic1,
      customerId: customer.value.id,
      petId: pet.value.id,
    });
    expect(visit.ok).toBe(true);
    if (!visit.ok) return;
    createdVisitIds.push(visit.value.id);

    const staffActor: ServiceActor = {
      userId: staffUserId!,
      clinicIds: [clinic1],
      defaultClinicId: clinic1,
      memberships: [{ clinicId: clinic1, role: "staff" }],
    };

    const denied = await visitService.softDeleteVisit(
      staffActor,
      visit.value.id,
      visit.value.version,
    );
    expect(denied.ok).toBe(false);

    await adminClient.from("clinic_memberships").delete().eq("user_id", staffUserId);
    await adminClient.from("profiles").delete().eq("id", staffUserId);
    await adminClient.auth.admin.deleteUser(staffUserId);
  });

  it("enforces RLS clinic isolation for visits", async () => {
    const otherVisits = await otherClient
      .from("visits")
      .select("id")
      .eq("clinic_id", clinic1);
    expect(otherVisits.error).toBeNull();
    expect((otherVisits.data ?? []).length).toBe(0);
  });
});
