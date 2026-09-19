import { describe, expect, it } from "vitest";
import { createAuditLogSchema } from "@/lib/validators/audit";
import { createAIEventSchema } from "@/lib/validators/ai-event";
import { problemListEntrySchema, updateMedicalRecordSchema } from "@/lib/validators/medical-record";

describe("validators", () => {
  it("rejects invalid audit log payloads", () => {
    const result = createAuditLogSchema.safeParse({
      actorType: "user",
      actorId: "",
      action: "test",
      entityType: "profile",
      entityId: "1",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid AI event payloads", () => {
    const result = createAIEventSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      sourceType: "test",
      agentName: "tomer",
      eventType: "foundation_check",
    });

    expect(result.success).toBe(true);
  });
});

describe("problemListEntrySchema", () => {
  it("accepts an entry with only a condition", () => {
    const result = problemListEntrySchema.safeParse({ condition: "אי ספיקת כליות" });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated entry", () => {
    const result = problemListEntrySchema.safeParse({
      condition: "סכרת",
      onsetDate: "2024-05-01",
      severity: "moderate",
      notes: "מאוזן תחת אינסולין",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a non-ISO onsetDate", () => {
    const result = problemListEntrySchema.safeParse({ condition: "סכרת", onsetDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects an onsetDate that is not a real calendar date", () => {
    const result = problemListEntrySchema.safeParse({ condition: "סכרת", onsetDate: "2024-13-45" });
    expect(result.success).toBe(false);
  });

  it("rejects a condition longer than 500 characters", () => {
    const result = problemListEntrySchema.safeParse({ condition: "א".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts a condition at exactly 500 characters", () => {
    const result = problemListEntrySchema.safeParse({ condition: "א".repeat(500) });
    expect(result.success).toBe(true);
  });

  it("rejects notes longer than 2000 characters", () => {
    const result = problemListEntrySchema.safeParse({ condition: "סכרת", notes: "א".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("rejects an entry missing condition", () => {
    const result = problemListEntrySchema.safeParse({ severity: "mild" });
    expect(result.success).toBe(false);
  });

  it("rejects an entry with a blank condition", () => {
    const result = problemListEntrySchema.safeParse({ condition: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid severity value", () => {
    const result = problemListEntrySchema.safeParse({ condition: "אלרגיה", severity: "critical" });
    expect(result.success).toBe(false);
  });

  it("accepts nulls for optional fields", () => {
    const result = problemListEntrySchema.safeParse({
      condition: "אלרגיה למזון",
      onsetDate: null,
      severity: null,
      notes: null,
    });

    expect(result.success).toBe(true);
  });
});

describe("updateMedicalRecordSchema", () => {
  it("accepts a typed activeProblemList array", () => {
    const result = updateMedicalRecordSchema.safeParse({
      activeProblemList: [{ condition: "אי ספיקת כליות", severity: "severe" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an activeProblemList entry with the wrong shape", () => {
    const result = updateMedicalRecordSchema.safeParse({
      activeProblemList: ["just a string"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an activeProblemList longer than 50 entries", () => {
    const result = updateMedicalRecordSchema.safeParse({
      activeProblemList: Array.from({ length: 51 }, (_, i) => ({ condition: `בעיה ${i}` })),
    });
    expect(result.success).toBe(false);
  });

  it("accepts an activeProblemList at exactly 50 entries", () => {
    const result = updateMedicalRecordSchema.safeParse({
      activeProblemList: Array.from({ length: 50 }, (_, i) => ({ condition: `בעיה ${i}` })),
    });
    expect(result.success).toBe(true);
  });
});
