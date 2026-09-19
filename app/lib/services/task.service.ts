import { AppError, err, type Result } from "@/lib/errors/app-error";
import type { TaskRepository } from "@/lib/repositories/task.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  CreateTaskInput,
  Task,
  TaskListFilters,
  TaskPriority,
  TaskSourceType,
  TaskStatus,
} from "@/types/domain/task";

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  async listTasks(
    actor: ServiceActor,
    input: Omit<TaskListFilters, "clinicIds">,
  ): Promise<Result<Task[]>> {
    return this.repository.list({ clinicIds: actor.clinicIds, ...input });
  }

  async createTask(actor: ServiceActor, input: CreateTaskInput): Promise<Result<Task>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create task for requested clinic"));
    }
    return this.repository.create({ ...input, createdByUserId: actor.userId });
  }

  async updateTask(
    actor: ServiceActor,
    taskId: string,
    expectedVersion: number,
    patch: {
      status?: TaskStatus;
      title?: string;
      description?: string | null;
      priority?: TaskPriority;
      dueAt?: string | null;
      assigneeUserId?: string | null;
      sourceType?: TaskSourceType;
      sourceId?: string | null;
    },
  ): Promise<Result<Task>> {
    const existing = await this.repository.findById(taskId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Task not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Task outside actor clinics"));
    }

    const columnPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) columnPatch.status = patch.status;
    if (patch.title !== undefined) columnPatch.title = patch.title;
    if (patch.description !== undefined) columnPatch.description = patch.description;
    if (patch.priority !== undefined) columnPatch.priority = patch.priority;
    if (patch.dueAt !== undefined) columnPatch.due_at = patch.dueAt;
    if (patch.assigneeUserId !== undefined) columnPatch.assignee_user_id = patch.assigneeUserId;
    if (patch.sourceType !== undefined) columnPatch.source_type = patch.sourceType;
    if (patch.sourceId !== undefined) columnPatch.source_id = patch.sourceId;
    if (patch.status === "done") columnPatch.completed_at = new Date().toISOString();

    return this.repository.updateVersioned(taskId, expectedVersion, columnPatch);
  }

  async completeTask(actor: ServiceActor, taskId: string): Promise<Result<Task>> {
    const existing = await this.repository.findById(taskId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Task not found"));
    return this.updateTask(actor, taskId, existing.value.version, { status: "done" });
  }
}
