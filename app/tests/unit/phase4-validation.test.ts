import { describe, expect, it } from "vitest";
import { assertMedicalDeleteAuthorized } from "@/lib/services/medical-authorization";
import {
  addMedicalNoteAddendumSchema,
  createMedicalNoteSchema,
  updateMedicalNoteSchema,
} from "@/lib/validators/medical-note";
import { createPrescriptionSchema } from "@/lib/validators/prescription";
import { createVaccinationSchema } from "@/lib/validators/vaccination";
import {
  createVisitSchema,
  deleteVisitSchema,
  updateVisitSchema,
} from "@/lib/validators/visit";

describe("phase4 validators", () => {
  it("accepts valid create visit payload", () => {
    const result = createVisitSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      customerId: "00000000-0000-4000-8000-000000000010",
      petId: "00000000-0000-4000-8000-000000000011",
    });
    expect(result.success).toBe(true);
  });

  it("requires version for visit updates", () => {
    const result = updateVisitSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(false);
  });

  it("requires version for visit delete", () => {
    const result = deleteVisitSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty medical note content", () => {
    const result = createMedicalNoteSchema.safeParse({
      noteType: "general",
      content: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects creating an addendum note without a parentNoteId", () => {
    const result = createMedicalNoteSchema.safeParse({
      noteType: "addendum",
      content: "תוספת",
    });
    expect(result.success).toBe(false);
  });

  it("accepts creating an addendum note with a valid parentNoteId", () => {
    const result = createMedicalNoteSchema.safeParse({
      noteType: "addendum",
      content: "תוספת",
      parentNoteId: "00000000-0000-4000-8000-000000000099",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-addendum note that carries a parentNoteId", () => {
    const result = createMedicalNoteSchema.safeParse({
      noteType: "general",
      content: "הערה רגילה",
      parentNoteId: "00000000-0000-4000-8000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  it("silently strips a client-supplied status:'approved' on note creation instead of honoring it (status is not a field of this schema; approval is only reachable via the dedicated approve endpoint)", () => {
    const result = createMedicalNoteSchema.safeParse({
      noteType: "general",
      content: "הערה רגילה",
      status: "approved",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("status");
    }
  });

  it("silently strips a client-supplied status:'archived' on note creation the same way", () => {
    const result = createMedicalNoteSchema.safeParse({
      noteType: "general",
      content: "הערה רגילה",
      status: "archived",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("status");
    }
  });

  it("rejects switching a note's type to addendum via update without a parentNoteId", () => {
    const result = updateMedicalNoteSchema.safeParse({ noteType: "addendum" });
    expect(result.success).toBe(false);
  });

  it("rejects an update carrying a parentNoteId without noteType 'addendum'", () => {
    const result = updateMedicalNoteSchema.safeParse({
      parentNoteId: "00000000-0000-4000-8000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an update that sets noteType to addendum together with a parentNoteId", () => {
    const result = updateMedicalNoteSchema.safeParse({
      noteType: "addendum",
      parentNoteId: "00000000-0000-4000-8000-000000000099",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an addendum body without content", () => {
    const result = addMedicalNoteAddendumSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a minimal valid addendum body", () => {
    const result = addMedicalNoteAddendumSchema.safeParse({ content: "תוספת" });
    expect(result.success).toBe(true);
  });

  it("accepts vaccination with administered timestamp", () => {
    const result = createVaccinationSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      customerId: "00000000-0000-4000-8000-000000000010",
      vaccineName: "Rabies",
      administeredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("allows owner/admin/veterinarian medical delete roles", () => {
    const actor = {
      userId: "user-1",
      clinicIds: ["clinic-1"],
      defaultClinicId: "clinic-1",
      memberships: [{ clinicId: "clinic-1", role: "veterinarian" as const }],
    };
    expect(assertMedicalDeleteAuthorized(actor, "clinic-1").ok).toBe(true);
  });

  it("denies staff medical delete role", () => {
    const actor = {
      userId: "user-2",
      clinicIds: ["clinic-1"],
      defaultClinicId: "clinic-1",
      memberships: [{ clinicId: "clinic-1", role: "staff" as const }],
    };
    expect(assertMedicalDeleteAuthorized(actor, "clinic-1").ok).toBe(false);
  });

  it("requires prescription instructions", () => {
    const result = createPrescriptionSchema.safeParse({
      medicationName: "Amoxicillin",
      instructions: "",
    });
    expect(result.success).toBe(false);
  });
});
