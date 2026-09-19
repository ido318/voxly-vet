import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("phase5 visit workspace UI", () => {
  it("uses dedicated workspace components on the visit page", () => {
    const page = source("app/dashboard/visits/[visitId]/page.tsx");
    const workspace = source("app/dashboard/visits/visit-workspace.tsx");

    expect(page).toContain("VisitWorkspace");
    expect(workspace).toContain("VisitSectionNav");
    expect(workspace).toContain("AnamnesisForm");
    expect(workspace).toContain("VitalsForm");
    expect(workspace).toContain("ExamForm");
    expect(workspace).toContain("SoapEditor");
    expect(workspace).toContain("CloseVisitModal");
  });

  it("posts vitals and close-visit through dedicated APIs", () => {
    const vitals = source("app/dashboard/visits/vitals-form.tsx");
    const close = source("app/dashboard/visits/close-visit-modal.tsx");

    expect(vitals).toContain("/vitals");
    expect(vitals).toContain("weightKg");
    expect(vitals).toContain("temperatureC");
    expect(close).toContain("/close");
  });
});
