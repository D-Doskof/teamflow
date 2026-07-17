import { z } from 'zod';

export const createBoardSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const createTaskListSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  position: z.number().int().min(0).optional(),
});

export const updateTaskListSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  position: z.number().int().min(0).optional(),
});

export type CreateBoardDto = z.infer<typeof createBoardSchema>;
export type UpdateBoardDto = z.infer<typeof updateBoardSchema>;
export type CreateTaskListDto = z.infer<typeof createTaskListSchema>;
export type UpdateTaskListDto = z.infer<typeof updateTaskListSchema>;
