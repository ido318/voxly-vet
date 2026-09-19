import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapTaskRow } from "@/lib/repositories/mappers";
import type {
  CreateTaskInput,
  Task,
  TaskListFilters,
} from "@/types/domain/task";

const SELECT_WITH_JOINS = `
  *,
  customer:customers!tasks_customer_clinic_fk(full_name),
  pet:pets!tasks_pet_clinic_fk(name)
`;

export class TaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: TaskListFilters): Promise<Result<Task[]>> {
    let query = this.client
      .from("tasks")
      .select(SELECT_WITH_JOINS)
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.sourceType) query = query.eq("source_type", filters.sourceType);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list tasks", error));
    return ok((data ?? []).map(mapTaskRow));
  }

  async findById(taskId: string): Promise<Result<Task | null>> {
    const { data, error } = await this.client
      .from("tasks")
      .select(SELECT_WITH_JOINS)
      .eq("id", taskId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load task", error));
    return ok(data ? mapTaskRow(data) : null);
  }

  async create(input: CreateTaskInput & { createdByUserId: string }): Promise<Result<Task>> {
    const { data, error } = await this.client
      .from("tasks")
      .insert({
        clinic_id: input.clinicId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "medium",
        due_at: input.dueAt ?? null,
        assignee_user_id: input.assigneeUserId ?? null,
        customer_id: input.customerId ?? null,
        pet_id: input.petId ?? null,
        source_type: input.sourceType ?? "manual",
        source_id: input.sourceId ?? null,
        created_by_user_id: input.createdByUserId,
      })
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) return err(AppError.externalProvider("Failed to create task", error));
    return ok(mapTaskRow(data));
  }

  async updateVersioned(
    taskId: string,
    expectedVersion: number,
    patch: Record<string, unknown>,
  ): Promise<Result<Task>> {
    const { data, error } = await this.client
      .from("tasks")
      .update({ ...patch, version: expectedVersion + 1 })
      .eq("id", taskId)
      .eq("version", expectedVersion)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(
          AppError.conflict("Task update conflict: stale version", { taskId, expectedVersion }),
        );
      }
      return err(AppError.externalProvider("Failed to update task", error));
    }
    return ok(mapTaskRow(data));
  }
}
