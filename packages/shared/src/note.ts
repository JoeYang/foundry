import { z } from 'zod';
import { actorSchema } from './enums.js';

const pathSchema = z.string().min(1);

export const addNoteInputSchema = z.object({
  path: pathSchema,
  body: z.string().min(1),
  author: actorSchema,
});
export type AddNoteInput = z.infer<typeof addNoteInputSchema>;

export const noteSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  body: z.string(),
  author: z.string(),
  created_at: z.string(),
});
export type Note = z.infer<typeof noteSchema>;
