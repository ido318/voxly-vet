import { z } from "zod";

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);
export const taskStatusSchema = z.enum(["open", "done"]);
export const taskSourceTypeSchema = z.enum(["manual", "visit", "call", "follow_up"]);

export const createTaskSchema = z.object({
  clinicId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  assigneeUserId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  petId: z.string().uuid().optional().nullable(),
  sourceType: taskSourceTypeSchema.optional(),
  sourceId: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = z.object({
  version: z.number().int().min(0),
  status: taskStatusSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  assigneeUserId: z.string().uuid().optional().nullable(),
  sourceType: taskSourceTypeSchema.optional(),
  sourceId: z.string().uuid().optional().nullable(),
});

export const listTasksSchema = z.object({
  status: taskStatusSchema.optional(),
  sourceType: taskSourceTypeSchema.optional(),
});
