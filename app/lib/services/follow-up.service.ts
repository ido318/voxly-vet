import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { FollowUpRepository } from "@/lib/repositories/follow-up.repository";
import type { TaskService } from "@/lib/services/task.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  CreateFollowUpInput,
  FollowUp,
  FollowUpListFilters,
} from "@/types/domain/follow-up";
import type { Visit } from "@/types/domain/visit";

export class FollowUpService {
  constructor(
    private readonly repository: FollowUpRepository,
    private readonly taskService: TaskService,
  ) {}

  async listFollowUps(
    actor: ServiceActor,
    input: Omit<FollowUpListFilters, "clinicIds">,
  ): Promise<Result<FollowUp[]>> {
    return this.repository.list({ clinicIds: actor.clinicIds, ...input });
  }

  async createFollowUp(
    actor: ServiceActor,
    input: CreateFollowUpInput,
  ): Promise<Result<FollowUp>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create follow-up for requested clinic"));
    }

    const sourceType = input.voiceCallId ? "call" : input.visitId ? "visit" : "follow_up";
    const sourceId = input.voiceCallId ?? input.visitId ?? null;
    const task = await this.taskService.createTask(actor, {
      clinicId: input.clinicId,
      title: `מעקב: ${input.reason}`,
      description: input.reason,
      priority: "medium",
      dueAt: input.dueAt,
      customerId: input.customerId,
      petId: input.petId ?? null,
      sourceType,
      sourceId,
    });
    if (!task.ok) return err(task.error);

    return this.repository.create({
      ...input,
      taskId: task.value.id,
      createdByUserId: actor.userId,
    });
  }

  async createFromVisitClose(
    actor: ServiceActor,
    visit: Visit,
    input: { reason: string; dueAt: string },
  ): Promise<Result<FollowUp>> {
    return this.createFollowUp(actor, {
      clinicId: visit.clinicId,
      customerId: visit.customerId,
      petId: visit.petId,
      visitId: visit.id,
      reason: input.reason,
      dueAt: input.dueAt,
    });
  }

  async completeFollowUp(
    actor: ServiceActor,
    followUpId: string,
    expectedVersion: number,
  ): Promise<Result<FollowUp>> {
    const existing = await this.repository.findById(followUpId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Follow-up not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Follow-up outside actor clinics"));
    }

    const completedAt = new Date().toISOString();
    const updated = await this.repository.updateVersioned(followUpId, expectedVersion, {
      status: "done",
      completed_at: completedAt,
      completed_by_user_id: actor.userId,
    });
    if (!updated.ok) return updated;

    if (existing.value.taskId) {
      const task = await this.taskService.completeTask(actor, existing.value.taskId);
      if (!task.ok && task.error.code !== "CONFLICT") return err(task.error);
    }

    return ok(updated.value);
  }
}
