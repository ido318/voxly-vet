import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("pet profile edit form", () => {
  it("lets Dana edit the full medical profile fields from the pet page", () => {
    const pageSource = readFileSync(join(process.cwd(), "app/dashboard/pets/[petId]/page.tsx"), "utf8");
    const formSource = readFileSync(join(process.cwd(), "app/dashboard/pets/[petId]/pet-profile-form.tsx"), "utf8");
    const combined = `${pageSource}\n${formSource}`;

    expect(combined).toContain("PetProfileForm");
    expect(combined).toContain('name="sex"');
    expect(combined).toContain('name="weight"');
    expect(combined).toContain('name="isNeutered"');
    expect(combined).toContain('name="birthDate"');
    expect(combined).toContain('name="chipNumber"');
    expect(combined).toContain('name="status"');
    expect(combined).toContain('name="breed"');
    expect(combined).toContain("PATCH");
    expect(combined).toContain(`/api/pets/$`);
  });
});
