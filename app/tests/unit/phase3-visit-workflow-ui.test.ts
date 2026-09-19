import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("phase3 appointment to visit UI", () => {
  it("exposes check-in and open-visit actions from the appointment drawer", () => {
    const drawer = source("app/dashboard/calendar/appointment-drawer.tsx");

    expect(drawer).toContain("/check-in");
    expect(drawer).toContain("/open-visit");
    expect(drawer).toContain("צ׳ק־אין");
    expect(drawer).toContain("פתח ביקור");
  });

  it("models checked-in and in-visit sections on today's command center", () => {
    const model = source("app/dashboard/today-dashboard-model.ts");
    const sections = source("app/dashboard/today-dashboard-sections.tsx");

    expect(model).toContain("checkedInRows");
    expect(model).toContain("inVisitRows");
    expect(sections).toContain("ממתינים לביקור");
    expect(sections).toContain("בטיפול");
  });

  it("keeps SOAP structured fields visible in the visit workspace", () => {
    const notes = source("app/dashboard/visits/visit-notes-section.tsx");
    const visitPage = source("app/dashboard/visits/[visitId]/page.tsx");

    expect(notes).toContain("subjective");
    expect(notes).toContain("objective");
    expect(notes).toContain("assessment");
    expect(notes).toContain("plan");
    expect(notes).toContain("content");
    expect(visitPage).toContain("רקע לביקור");
    expect(visitPage).toContain("/api/appointments/");
  });
});
