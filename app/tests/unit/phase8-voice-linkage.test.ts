import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { VoiceCallService } from "@/lib/services/voice-call.service";
import type { ServiceActor } from "@/lib/services/service-context";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const actor: ServiceActor = {
  userId: "user1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "staff" }],
};

describe("Phase 8 voice linkage", () => {
  it("adds call linkage columns without creating phone_calls", () => {
    const migration = source("../supabase/migrations/20260901005108_phase8_voice_call_linkage.sql");

    expect(migration).toContain("alter table public.voice_calls");
    expect(migration).toContain("appointment_id");
    expect(migration).toContain("visit_id");
    expect(migration).not.toContain("phone_calls");
  });

  it("links a call through the voice call service", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(ok({
        id: "call1",
        clinicId: "clinic1",
      })),
      link: vi.fn().mockResolvedValue(ok({
        id: "call1",
        clinicId: "clinic1",
        appointmentId: "appointment1",
      })),
    };
    const service = new VoiceCallService(repository as never);

    const result = await service.linkCall(actor, "call1", {
      appointmentId: "appointment1",
      petId: "pet1",
    });

    expect(result.ok).toBe(true);
    expect(repository.link).toHaveBeenCalledWith("call1", {
      appointmentId: "appointment1",
      petId: "pet1",
    });
  });

  it("renders pre-visit call context from the visit page", () => {
    const visitPage = source("app/dashboard/visits/[visitId]/page.tsx");
    const brief = source("app/dashboard/voice/pre-visit-brief-card.tsx");

    expect(visitPage).toContain("PreVisitBriefCard");
    expect(visitPage).toContain("visitId=");
    expect(brief).toContain("Pre-visit brief");
  });

  it("can create a follow-up task from the call drawer", () => {
    const callsPage = source("app/dashboard/calls/page.tsx");

    expect(callsPage).toContain("/api/follow-ups");
    expect(callsPage).toContain("voiceCallId: call.id");
    expect(callsPage).toContain("צור משימה מהשיחה");
  });
});
