import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { AppointmentService } from "@/lib/services/appointment.service";
import { AuditService } from "@/lib/services/audit.service";
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
const clinic2 = "00000000-0000-4000-8000-000000000002";

describe.runIf(runIntegration)("phase3 appointments + calendar constraints", () => {
  let ownerClient: TestSupabaseClient;
  let otherClient: TestSupabaseClient;
  let adminClient: TestSupabaseClient;
  let ownerUserId = "";
  let otherUserId = "";
  let actor: ServiceActor;
  const createdCustomerIds: string[] = [];
  const createdPetIds: string[] = [];
  const createdAppointmentIds: string[] = [];

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

    const otherEmail = `phase3-other-${Date.now()}@demo-clinic.local`;
    const created = await adminClient.auth.admin.createUser({
      email: otherEmail,
      password: "phase3-test-password",
      email_confirm: true,
      user_metadata: { full_name: "Phase3 Other User" },
    });
    if (!created.data.user) throw new Error("Could not create second clinic user");
    otherUserId = created.data.user.id;

    await adminClient.from("profiles").upsert({
      id: otherUserId,
      full_name: "Phase3 Other User",
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
      password: "phase3-test-password",
    });
    if (otherLogin.error) {
      throw new Error(`Other login failed: ${otherLogin.error.message}`);
    }
  });

  afterAll(async () => {
    if (createdAppointmentIds.length > 0) {
      await adminClient.from("appointments").delete().in("id", createdAppointmentIds);
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
      .in("action", ["appointment.create", "appointment.update", "appointment.status_change", "appointment.delete"]);

    if (otherUserId) {
      await adminClient.from("clinic_memberships").delete().eq("user_id", otherUserId);
      await adminClient.from("profiles").delete().eq("id", otherUserId);
      await adminClient.auth.admin.deleteUser(otherUserId);
    }

    await ownerClient.auth.signOut();
    await otherClient.auth.signOut();
  });

  it("enforces version checks, overlap rules, soft delete, and audit logs", async () => {
    const customerRepository = new CustomerRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);
    const appointmentRepository = new AppointmentRepository(ownerClient);
    const auditService = new AuditService(new AuditLogRepository(adminClient));
    const appointmentService = new AppointmentService(
      appointmentRepository,
      customerRepository,
      petRepository,
      auditService,
    );

    const customer = await customerRepository.insert({
      clinicId: clinic1,
      fullName: `Phase3 Customer ${Date.now()}`,
      preferredContactMethod: "phone",
      status: "active",
    });
    expect(customer.ok).toBe(true);
    if (!customer.ok) return;
    createdCustomerIds.push(customer.value.id);

    const pet = await petRepository.insert({
      clinicId: clinic1,
      customerId: customer.value.id,
      name: "Bambi",
      species: "dog",
      status: "active",
    });
    expect(pet.ok).toBe(true);
    if (!pet.ok) return;
    createdPetIds.push(pet.value.id);

    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const createdAppointment = await appointmentService.createAppointment(actor, {
      clinicId: clinic1,
      customerId: customer.value.id,
      petId: pet.value.id,
      appointmentType: "checkup",
      source: "front_desk",
      scheduledAt,
      durationMinutes: 40,
    });
    expect(createdAppointment.ok).toBe(true);
    if (!createdAppointment.ok) return;
    createdAppointmentIds.push(createdAppointment.value.id);

    const staleUpdate = await appointmentService.updateAppointment(
      actor,
      createdAppointment.value.id,
      createdAppointment.value.version + 1,
      { notes: "stale" },
    );
    expect(staleUpdate.ok).toBe(false);

    const overlapping = await appointmentService.createAppointment(actor, {
      clinicId: clinic1,
      customerId: customer.value.id,
      petId: pet.value.id,
      appointmentType: "consultation",
      source: "phone",
      scheduledAt,
      durationMinutes: 30,
    });
    expect(overlapping.ok).toBe(false);

    const confirmed = await appointmentService.changeStatus(
      actor,
      createdAppointment.value.id,
      createdAppointment.value.version,
      { status: "confirmed" },
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const softDeleted = await appointmentService.softDelete(
      actor,
      createdAppointment.value.id,
      confirmed.value.version,
    );
    expect(softDeleted.ok).toBe(true);

    const listAfterDelete = await appointmentRepository.list({ clinicIds: [clinic1] });
    expect(listAfterDelete.ok).toBe(true);
    if (listAfterDelete.ok) {
      expect(
        listAfterDelete.value.some((row) => row.id === createdAppointment.value.id),
      ).toBe(false);
    }

    const auditRows = await adminClient
      .from("audit_logs")
      .select("action")
      .in("action", ["appointment.create", "appointment.status_change", "appointment.delete"])
      .eq("actor_id", ownerUserId);
    expect(auditRows.error).toBeNull();
    expect((auditRows.data ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("enforces database overlap barrier against race-condition style direct insert", async () => {
    const customerRepository = new CustomerRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);
    const appointmentRepository = new AppointmentRepository(ownerClient);

    const customer = await customerRepository.insert({
      clinicId: clinic1,
      fullName: `Phase3 DB Barrier ${Date.now()}`,
      preferredContactMethod: "phone",
      status: "active",
    });
    expect(customer.ok).toBe(true);
    if (!customer.ok) return;
    createdCustomerIds.push(customer.value.id);

    const pet = await petRepository.insert({
      clinicId: clinic1,
      customerId: customer.value.id,
      name: "RacePet",
      species: "cat",
      status: "active",
    });
    expect(pet.ok).toBe(true);
    if (!pet.ok) return;
    createdPetIds.push(pet.value.id);

    const slot = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const first = await appointmentRepository.create(
      {
        clinicId: clinic1,
        customerId: customer.value.id,
        petId: pet.value.id,
        appointmentType: "checkup",
        source: "internal",
        scheduledAt: slot,
        durationMinutes: 40,
      },
      ownerUserId,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    createdAppointmentIds.push(first.value.id);

    const second = await appointmentRepository.create(
      {
        clinicId: clinic1,
        customerId: customer.value.id,
        petId: pet.value.id,
        appointmentType: "urgent",
        source: "phone",
        scheduledAt: slot,
        durationMinutes: 30,
      },
      ownerUserId,
    );
    expect(second.ok).toBe(false);
  });

  it("enforces RLS clinic isolation for appointments", async () => {
    const ownerAppointments = await ownerClient
      .from("appointments")
      .select("id, clinic_id")
      .eq("clinic_id", clinic1);
    expect(ownerAppointments.error).toBeNull();

    const otherAppointments = await otherClient
      .from("appointments")
      .select("id, clinic_id")
      .eq("clinic_id", clinic1);
    expect(otherAppointments.error).toBeNull();
    expect((otherAppointments.data ?? []).length).toBe(0);
  });
});
