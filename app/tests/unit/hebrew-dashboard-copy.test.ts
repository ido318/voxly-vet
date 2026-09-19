import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = [
  "app/dashboard/visits/page.tsx",
  "app/dashboard/visits/new/page.tsx",
  "app/dashboard/visits/[visitId]/page.tsx",
  "app/dashboard/visits/visit-form.tsx",
  "app/dashboard/visits/visit-actions.tsx",
  "app/dashboard/visits/visit-ai-summary-section.tsx",
  "app/dashboard/visits/visit-notes-section.tsx",
  "app/dashboard/visits/visit-prescriptions-section.tsx",
  "app/dashboard/visits/visit-vaccinations-section.tsx",
  "app/dashboard/visits/vitals-form.tsx",
  "app/dashboard/visits/exam-form.tsx",
  "app/dashboard/visits/visit-section-nav.tsx",
  "app/dashboard/pets/[petId]/page.tsx",
  "app/dashboard/voice/[callId]/page.tsx",
  "app/dashboard/voice/[callId]/call-recording-player.tsx",
];

const FORBIDDEN_COPY = [
  "Visit not found",
  "Back to visits",
  "New visit",
  "Chief complaint",
  "Manual visit summary",
  "Visit summaries",
  "Failed to",
  "Saving...",
  "Creating...",
  "No notes yet",
  "No prescriptions yet",
  "No vaccinations",
  "Medication name",
  "Vaccine name",
  "Batch number",
  "Generate draft",
  "Accept summary",
  "Recent visits",
  "Medical history",
  "Voice call detail",
  "Open recording",
  "General",
  "Cardiovascular",
  "Gastrointestinal",
  "Musculoskeletal",
  "Neurological",
  "Eyes/Ears/Nose/Throat",
  "Skin/Coat",
  "Physical Exam",
  "Anamnesis",
  'placeholder="weightKg"',
  'placeholder="temperatureC"',
  'placeholder="heartRateBpm"',
  'placeholder="respiratoryRateBpm"',
  'placeholder="painScore"',
  'placeholder="notes"',
];

describe("Hebrew dashboard copy", () => {
  it("keeps medical, pet and call workflow UI copy in Hebrew", () => {
    const combined = FILES.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");

    for (const phrase of FORBIDDEN_COPY) {
      expect(combined).not.toContain(phrase);
    }
  });
});
