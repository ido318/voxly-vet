import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { EscalationService } from "@/lib/services/escalation.service";
import type { EscalationRepository } from "@/lib/repositories/escalation.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Escalation } from "@/types/domain/escalation";

const TARGET_CLINIC = "clinic-target";
const OTHER_CLINIC = "clinic-other";

const actor: ServiceActor = {
  userId: "user-1",
  clinicIds: [TARGET_CLINIC, OTHER_CLINIC],
  defaultClinicId: TARGET_CLINIC,
  memberships: [
    { clinicId: TARGET_CLINIC, role: "staff" },
    { clinicId: OTHER_CLINIC, role: "owner" },
  ],
};

function escalation(): Escalation {
  return {
    id: "esc-1",
    clinicId: TARGET_CLINIC,
    voiceCallId: null,
    elevenLabsConversationId: null,
    callerPhone: null,
    customerId: null,
    customerName: null,
    petId: null,
    petName: null,
    context: {},
    reason: "לקוח מבקש שיחה",
    urgency: 7,
    resolvedAt: null,
    resolvedBy: null,
    notes: null,
    createdAt: "2026-06-20T09:00:00.000Z",
    updatedAt: "2026-06-20T09:00:00.000Z",
  };
}

function buildService() {
  const repo = {
    findById: vi.fn().mockResolvedValue(ok(escalation())),
    resolve: vi.fn().mockResolvedValue(ok({
      ...escalation(),
      resolvedAt: "2026-06-20T10:00:00.000Z",
      resolvedBy: actor.userId,
    })),
  };
  const service = new EscalationService(null as never, repo as unknown as EscalationRepository);
  return { service, repo };
}

describe("EscalationService privileged actions", () => {
  it("forbids resolving escalations without owner/admin role in the escalation clinic", async () => {
    const { service, repo } = buildService();

    const result = await service.resolve(actor, "esc-1", "טופל");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(repo.resolve).not.toHaveBeenCalled();
  });

  it("allows resolving escalations with owner/admin role in the escalation clinic", async () => {
    const { service, repo } = buildService();
    const privilegedActor: ServiceActor = {
      ...actor,
      memberships: [{ clinicId: TARGET_CLINIC, role: "admin" }],
    };

    const result = await service.resolve(privilegedActor, "esc-1", "טופל");

    expect(result.ok).toBe(true);
    expect(repo.resolve).toHaveBeenCalledWith("esc-1", {
      notes: "טופל",
      resolvedByUserId: privilegedActor.userId,
    });
  });
});
