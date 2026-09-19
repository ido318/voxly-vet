import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { AuditService } from "@/lib/services/audit.service";
import { CustomerService } from "@/lib/services/customer.service";
import { PetService } from "@/lib/services/pet.service";
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

describe.runIf(runIntegration)("phase2 customers + pets", () => {
  let ownerClient: TestSupabaseClient;
  let otherClient: TestSupabaseClient;
  let adminClient: TestSupabaseClient;
  let ownerUserId = "";
  let otherUserId = "";
  const createdCustomerIds: string[] = [];
  const createdPetIds: string[] = [];

  beforeAll(async () => {
    adminClient = createTestSupabaseClient(supabaseUrl!, serviceRoleKey!);
    ownerClient = createTestSupabaseClient(supabaseUrl!, anonKey!);
    otherClient = createTestSupabaseClient(supabaseUrl!, anonKey!);

    const ownerLogin = await ownerClient.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    if (ownerLogin.error || !ownerLogin.data.user) {
      throw new Error(`Failed to login owner user: ${ownerLogin.error?.message}`);
    }
    ownerUserId = ownerLogin.data.user.id;

    await adminClient
      .from("clinics")
      .upsert({ id: clinic2, name: "Clinic Two", slug: "clinic-two", timezone: "Asia/Jerusalem" });

    const otherEmail = `clinic2-owner-${Date.now()}@demo-clinic.local`;
    const created = await adminClient.auth.admin.createUser({
      email: otherEmail,
      password: "phase2-test-password",
      email_confirm: true,
      user_metadata: { full_name: "Clinic Two Owner" },
    });
    if (!created.data.user) {
      throw new Error("Failed to create secondary user");
    }
    otherUserId = created.data.user.id;

    await adminClient.from("profiles").upsert({
      id: otherUserId,
      full_name: "Clinic Two Owner",
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
      password: "phase2-test-password",
    });
    if (otherLogin.error) {
      throw new Error(`Failed to login other user: ${otherLogin.error.message}`);
    }
  });

  afterAll(async () => {
    if (createdPetIds.length > 0) {
      await adminClient.from("pets").delete().in("id", createdPetIds);
    }
    if (createdCustomerIds.length > 0) {
      await adminClient.from("customers").delete().in("id", createdCustomerIds);
    }
    await adminClient
      .from("audit_logs")
      .delete()
      .in("action", ["customer.create", "customer.update", "customer.delete", "pet.create", "pet.update", "pet.delete"]);

    if (otherUserId) {
      await adminClient.from("clinic_memberships").delete().eq("user_id", otherUserId);
      await adminClient.from("profiles").delete().eq("id", otherUserId);
      await adminClient.auth.admin.deleteUser(otherUserId);
    }

    await ownerClient.auth.signOut();
    await otherClient.auth.signOut();
  });

  it("supports customer and pet CRUD via repositories with soft delete", async () => {
    const customerRepository = new CustomerRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);

    const createdCustomer = await customerRepository.insert({
      clinicId: clinic1,
      fullName: `Phase2 Customer ${Date.now()}`,
      phone: `050${Date.now().toString().slice(-7)}`,
      email: `customer-${Date.now()}@test.local`,
      preferredContactMethod: "phone",
      status: "active",
    });
    expect(createdCustomer.ok).toBe(true);
    if (!createdCustomer.ok) return;
    createdCustomerIds.push(createdCustomer.value.id);

    const listedCustomers = await customerRepository.list({ clinicIds: [clinic1] });
    expect(listedCustomers.ok).toBe(true);
    if (listedCustomers.ok) {
      expect(
        listedCustomers.value.some((customer) => customer.id === createdCustomer.value.id),
      ).toBe(true);
    }

    const createdPet = await petRepository.insert({
      clinicId: clinic1,
      customerId: createdCustomer.value.id,
      name: "Moka",
      species: "cat",
      status: "active",
    });
    expect(createdPet.ok).toBe(true);
    if (!createdPet.ok) return;
    createdPetIds.push(createdPet.value.id);

    const softDeletePet = await petRepository.softDelete(createdPet.value.id);
    if (!softDeletePet.ok) {
      throw new Error(
        `softDeletePet failed: ${softDeletePet.error.message} details=${JSON.stringify(softDeletePet.error.details)}`,
      );
    }
    expect(softDeletePet.ok).toBe(true);
    const listedPets = await petRepository.list({ clinicIds: [clinic1] });
    expect(listedPets.ok).toBe(true);
    if (listedPets.ok) {
      expect(listedPets.value.some((pet) => pet.id === createdPet.value.id)).toBe(false);
    }
  });

  it("enforces pet.customer clinic consistency in service layer and creates audit logs", async () => {
    const auditService = new AuditService(new AuditLogRepository(adminClient));
    const customerRepository = new CustomerRepository(ownerClient);
    const petRepository = new PetRepository(ownerClient);
    const customerService = new CustomerService(customerRepository, petRepository, auditService);
    const petService = new PetService(petRepository, customerRepository, auditService);

    const customerResult = await customerService.createCustomer(
      {
        userId: ownerUserId,
        clinicIds: [clinic1],
        defaultClinicId: clinic1,
        memberships: [{ clinicId: clinic1, role: "owner" }],
      },
      {
        clinicId: clinic1,
        fullName: `Svc Customer ${Date.now()}`,
        preferredContactMethod: "whatsapp",
        status: "active",
      },
    );
    expect(customerResult.ok).toBe(true);
    if (!customerResult.ok) return;
    createdCustomerIds.push(customerResult.value.id);

    const mismatch = await petService.createPet(
      {
        userId: ownerUserId,
        clinicIds: [clinic1],
        defaultClinicId: clinic1,
        memberships: [{ clinicId: clinic1, role: "owner" }],
      },
      {
        clinicId: clinic2,
        customerId: customerResult.value.id,
        name: "CrossClinicPet",
        species: "dog",
      },
    );
    expect(mismatch.ok).toBe(false);

    const validPet = await petService.createPet(
      {
        userId: ownerUserId,
        clinicIds: [clinic1],
        defaultClinicId: clinic1,
        memberships: [{ clinicId: clinic1, role: "owner" }],
      },
      {
        clinicId: clinic1,
        customerId: customerResult.value.id,
        name: "Rex",
        species: "dog",
      },
    );
    expect(validPet.ok).toBe(true);
    if (!validPet.ok) return;
    createdPetIds.push(validPet.value.id);

    const deletePet = await petService.softDeletePet(
      {
        userId: ownerUserId,
        clinicIds: [clinic1],
        defaultClinicId: clinic1,
        memberships: [{ clinicId: clinic1, role: "owner" }],
      },
      validPet.value.id,
    );
    if (!deletePet.ok) {
      throw new Error(
        `deletePet failed: ${deletePet.error.message} details=${JSON.stringify(deletePet.error.details)}`,
      );
    }
    expect(deletePet.ok).toBe(true);

    const auditRows = await adminClient
      .from("audit_logs")
      .select("action")
      .in("action", ["customer.create", "pet.create", "pet.delete"])
      .eq("actor_id", ownerUserId);
    expect(auditRows.error).toBeNull();
    expect((auditRows.data ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("enforces clinic RLS isolation between clinic members", async () => {
    const ownerCustomers = await ownerClient
      .from("customers")
      .select("id, clinic_id")
      .eq("clinic_id", clinic1);
    expect(ownerCustomers.error).toBeNull();
    expect((ownerCustomers.data ?? []).length).toBeGreaterThan(0);

    const otherCustomers = await otherClient
      .from("customers")
      .select("id, clinic_id")
      .eq("clinic_id", clinic1);
    expect(otherCustomers.error).toBeNull();
    expect((otherCustomers.data ?? []).length).toBe(0);
  });
});
