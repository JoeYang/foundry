import { z } from 'zod';
import { actorSchema } from './enums.js';
import { pathSchema } from './common.js';

export const alternativeSchema = z.object({
  label: z.string().min(1),
  why_rejected: z.string().optional(),
});

export const decisionPayloadSchema = z
  .object({
    chosen: z.string().optional(),
    options_considered: z.array(z.string()).optional(),
    confidence: z.enum(['low', 'med', 'high']).optional(),
    revisit_by: z.string().optional(),
    tags: z.array(z.string()).optional(),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z
            .string()
            .url()
            .refine((u) => /^https?:\/\//i.test(u), 'url must use http or https'),
        }),
      )
      .optional(),
    related_decision_ids: z.array(z.string().uuid()).optional(),
  })
  .catchall(z.unknown());

export const addDecisionInputSchema = z.object({
  path: pathSchema,
  title: z.string().min(1),
  rationale: z.string().min(1),
  alternatives: z.array(alternativeSchema).optional(),
  decision: decisionPayloadSchema.optional(),
  actor: actorSchema,
});
export type AddDecisionInput = z.infer<typeof addDecisionInputSchema>;

export const supersedeDecisionInputSchema = addDecisionInputSchema.extend({
  prior_id: z.string().uuid(),
});
export type SupersedeDecisionInput = z.infer<typeof supersedeDecisionInputSchema>;

export const decisionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  title: z.string(),
  rationale: z.string(),
  alternatives: z.array(alternativeSchema),
  decision: z.record(z.string(), z.unknown()),
  superseded_by: z.string().uuid().nullable(),
  made_at: z.string(),
  made_by: z.string(),
});
export type Decision = z.infer<typeof decisionSchema>;
