import { z } from 'zod';
import { Priority, TaskStatus } from '@prisma/client';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(10000).trim().optional(),
  priority: z.nativeEnum(Priority).default(Priority.NONE),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  dueDate: z.string().datetime().optional().nullable(),
  position: z.number().int().min(0).optional(),
  assigneeIds: z.array(z.string().cuid()).optional(),
  labelIds: z.array(z.string().cuid()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(10000).trim().nullable().optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  taskListId: z.string().cuid().optional(),
  position: z.number().int().min(0).optional(),
});

export const taskFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().cuid().optional(),
  labelId: z.string().cuid().optional(),
  search: z.string().max(255).optional(),
  dueDateFrom: z.string().datetime().optional(),
  dueDateTo: z.string().datetime().optional(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type TaskFilterDto = z.infer<typeof taskFilterSchema>;
