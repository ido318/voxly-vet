export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "done";
export type TaskSourceType = "manual" | "visit" | "call" | "follow_up";

export type Task = {
  id: string;
  clinicId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  assigneeUserId: string | null;
  customerId: string | null;
  customerName?: string | null;
  petId: string | null;
  petName?: string | null;
  sourceType: TaskSourceType;
  sourceId: string | null;
  completedAt: string | null;
  createdByUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateTaskInput = {
  clinicId: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  assigneeUserId?: string | null;
  customerId?: string | null;
  petId?: string | null;
  sourceType?: TaskSourceType;
  sourceId?: string | null;
};

export type UpdateTaskInput = {
  version: number;
  status?: TaskStatus;
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  assigneeUserId?: string | null;
  sourceType?: TaskSourceType;
  sourceId?: string | null;
};

export type TaskListFilters = {
  clinicIds: string[];
  status?: TaskStatus;
  sourceType?: TaskSourceType;
};
