import { z } from 'zod';
import { actorSchema, todoStatusSchema } from './enums.js';
import { pathSchema } from './common.js';

export const addTodoInputSchema = z.object({
  path: pathSchema,
  text: z.string().min(1),
  actor: actorSchema,
});
export type AddTodoInput = z.infer<typeof addTodoInputSchema>;

export const updateTodoInputSchema = z.object({
  status: todoStatusSchema,
});
export type UpdateTodoInput = z.infer<typeof updateTodoInputSchema>;

export const todoSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  text: z.string(),
  status: todoStatusSchema,
  added_at: z.string(),
  completed_at: z.string().nullable(),
  added_by: z.string(),
});
export type Todo = z.infer<typeof todoSchema>;
