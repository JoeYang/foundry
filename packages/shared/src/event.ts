import { z } from 'zod';
import { projectStatusSchema, projectEventKindSchema } from './enums.js';

const fromToString = z.object({ from: z.string().nullable(), to: z.string() });
const fromToStringArray = z.object({
  from: z.array(z.string()),
  to: z.array(z.string()),
});
const fromToRecord = z.object({
  from: z.record(z.string(), z.unknown()),
  to: z.record(z.string(), z.unknown()),
});

export const eventPayloadSchemas = {
  created: z.object({}).strict(),
  status_changed: z.object({
    from: projectStatusSchema,
    to: projectStatusSchema,
    note: z.string().nullable().optional(),
  }),
  next_step_changed: fromToString.extend({ from: z.string().nullable() }),
  summary_changed: fromToString.extend({ from: z.string().nullable() }),
  goal_changed: fromToString.extend({ from: z.string().nullable() }),
  links_changed: fromToRecord,
  tech_stack_changed: fromToStringArray,
  human_flag_changed: z.object({
    flag: z.enum(['pinned', 'archived', 'needs_review', 'user_notes']),
    from: z.union([z.boolean(), z.string(), z.null()]),
    to: z.union([z.boolean(), z.string(), z.null()]),
  }),
} as const;

export const eventSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  kind: projectEventKindSchema,
  payload: z.record(z.string(), z.unknown()),
  actor: z.string(),
  occurred_at: z.string(),
});
export type ProjectEvent = z.infer<typeof eventSchema>;
