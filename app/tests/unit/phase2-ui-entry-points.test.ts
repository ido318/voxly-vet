import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("phase2 UI entry points", () => {
  it("shows a duplicate customer warning path in the new customer modal", () => {
    const modal = source("components/dashboard/new-customer-modal.tsx");

    expect(modal).toContain("duplicate");
    expect(modal).toContain("status === 409");
    expect(modal).toContain("/dashboard/clients?customerId=");
  });

  it("captures full pet intake fields in the new pet modal", () => {
    const modal = source("components/dashboard/new-pet-modal.tsx");

    expect(modal).toContain('id="petBirthDate"');
    expect(modal).toContain('id="petWeight"');
    expect(modal).toContain('id="petChipNumber"');
    expect(modal).toContain('id="petIsNeutered"');
    expect(modal).toContain('id="petAllergies"');
    expect(modal).toContain('id="petChronicConditions"');
    expect(modal).toContain('id="petNotes"');
  });

  it("adds a medical record shell tab to the pet profile", () => {
    const tabs = source("app/dashboard/pets/[petId]/pet-detail-tabs.tsx");
    const page = source("app/dashboard/pets/[petId]/page.tsx");

    expect(page).toContain("/medical-record");
    expect(tabs).toContain("medicalRecord");
    expect(tabs).toContain("תיק רפואי");
    expect(tabs).toContain("activeProblemList");
    expect(tabs).toContain("alerts");
  });

  it("adds a patient context drawer entry point to the pet profile", () => {
    const tabs = source("app/dashboard/pets/[petId]/pet-detail-tabs.tsx");
    const drawer = source("components/dashboard/patient-context-drawer.tsx");

    expect(tabs).toContain("PatientContextDrawer");
    expect(tabs).toContain("הקשר מטופל");
    expect(drawer).toContain("medicalRecord");
    expect(drawer).toContain("visits.slice(0, 5)");
  });
});
