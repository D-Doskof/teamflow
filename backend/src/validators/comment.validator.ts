import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
});

export type CreateCommentDto = z.infer<typeof createCommentSchema>;
export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;
