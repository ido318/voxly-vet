import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { dueTone } from "@/app/dashboard/tasks/due-badge";
import type { FollowUpRepository } from "@/lib/repositories/follow-up.repository";
import { TaskRepository } from "@/lib/repositories/task.repository";
import type { ServiceActor } from "@/lib/services/service-context";

const actor: ServiceActor = {
  userId: "user1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "veterinarian" }],
};

describe("Phase 7 follow-ups and tasks", () => {
  it("classifies due dates as overdue, due soon, or scheduled", () => {
    const now = new Date("2026-08-31T09:00:00.000Z");

    expect(dueTone("2026-08-31T08:59:00.000Z", now)).toBe("red");
    expect(dueTone("2026-09-01T08:00:00.000Z", now)).toBe("amber");
    expect(dueTone("2026-09-02T09:00:00.000Z", now)).toBe("muted");
    expect(dueTone(null, now)).toBe("muted");
  });

  it("creates a call-sourced task when creating a call follow-up", async () => {
    const followUpRepository = {
      create: vi.fn().mockResolvedValue(ok({
        id: "follow1",
        clinicId: "clinic1",
        customerId: "customer1",
        petId: null,
        voiceCallId: "call1",
        taskId: "task1",
        reason: "לחזור ללקוח",
        dueAt: "2026-09-01T09:00:00.000Z",
      })),
    };
    const taskService = {
      createTask: vi.fn().mockResolvedValue(ok({ id: "task1" })),
    };
    const service = new FollowUpService(
      followUpRepository as unknown as FollowUpRepository,
      taskService as never,
    );

    const result = await service.createFollowUp(actor, {
      clinicId: "clinic1",
      customerId: "customer1",
      voiceCallId: "call1",
      reason: "לחזור ללקוח",
      dueAt: "2026-09-01T09:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(taskService.createTask).toHaveBeenCalledWith(actor, expect.objectContaining({
      sourceType: "call",
      sourceId: "call1",
    }));
  });

  it("filters tasks by source type in repository list", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: undefined,
    };
    query.eq.mockReturnValueOnce(query).mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const client = { from: vi.fn().mockReturnValue(query) };
    const repository = new TaskRepository(client as never);

    await repository.list({ clinicIds: ["clinic1"], status: "open", sourceType: "call" });

    expect(query.eq).toHaveBeenCalledWith("status", "open");
    expect(query.eq).toHaveBeenCalledWith("source_type", "call");
  });
});
