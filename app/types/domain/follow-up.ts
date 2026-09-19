import type { TaskStatus } from "@/types/domain/task";

export type FollowUp = {
  id: string;
  clinicId: string;
  customerId: string;
  customerName?: string | null;
  petId: string | null;
  petName?: string | null;
  visitId: string | null;
  voiceCallId: string | null;
  taskId: string | null;
  reason: string;
  dueAt: string;
  status: TaskStatus;
  completedAt: string | null;
  completedByUserId: string | null;
  createdByUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateFollowUpInput = {
  clinicId: string;
  customerId: string;
  petId?: string | null;
  visitId?: string | null;
  voiceCallId?: string | null;
  reason: string;
  dueAt: string;
};

export type FollowUpListFilters = {
  clinicIds: string[];
  status?: TaskStatus;
};
