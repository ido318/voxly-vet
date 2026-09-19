import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("phase6 UI entry points", () => {
  it("creates prescription drafts and exposes an approve action", () => {
    const component = source("app/dashboard/visits/visit-prescriptions-section.tsx");
    const route = source("app/api/prescriptions/[prescriptionId]/approve/route.ts");

    expect(component).toContain("שמור טיוטת מרשם");
    expect(component).toContain("/approve");
    expect(route).toContain("approvePrescription");
  });

  it("records vaccination next due dates from the visit workspace", () => {
    const component = source("app/dashboard/visits/visit-vaccinations-section.tsx");

    expect(component).toContain("nextDueAt");
    expect(component).toContain('type="date"');
  });

  it("requires lab result input before completing from the lab screen", () => {
    const component = source("app/dashboard/lab/page.tsx");

    expect(component).toContain("תוצאת מעבדה לפני השלמה");
    expect(component).toContain("resultText");
    expect(component).toContain('status === "completed"');
  });
});
