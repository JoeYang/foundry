import { z } from 'zod';
import { projectStatusSchema, actorSchema } from './enums.js';

// Path: non-empty, no null bytes (Postgres text columns reject \x00)
const pathSchema = z
  .string()
  .min(1, 'path required')
  .refine((s) => !s.includes('\x00'), 'path must not contain null bytes');

const summarySchema = z.string().max(280, 'summary must be ≤ 280 characters');

const linksSchema = z.record(z.string(), z.string().url()).default({});
const metadataSchema = z.record(z.string(), z.unknown()).default({});

export const upsertProjectInputSchema = z.object({
  path: pathSchema,
  name: z.string().min(1),
  summary: summarySchema,
  goal: z.string().default(''),
  status: projectStatusSchema.optional(),
  status_note: z.string().nullable().optional(),
  next_step: z.string().nullable().optional(),
  tech_stack: z.array(z.string()).default([]),
  links: linksSchema,
  metadata: metadataSchema,
  actor: actorSchema,
});
export type UpsertProjectInput = z.infer<typeof upsertProjectInputSchema>;

export const setStatusInputSchema = z.object({
  path: pathSchema,
  status: projectStatusSchema,
  note: z.string().nullable().optional(),
  actor: actorSchema,
});
export type SetStatusInput = z.infer<typeof setStatusInputSchema>;

export const setNextStepInputSchema = z.object({
  path: pathSchema,
  next_step: z.string(),
  actor: actorSchema,
});
export type SetNextStepInput = z.infer<typeof setNextStepInputSchema>;

export const patchFlagsInputSchema = z.object({
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  needs_review: z.boolean().optional(),
  user_notes: z.string().nullable().optional(),
});
export type PatchFlagsInput = z.infer<typeof patchFlagsInputSchema>;

// Embedding column is vector(1536); represented in JSON as a number[] of length 1536 or null
const embeddingSchema = z.array(z.number()).length(1536).nullable();

export const projectSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  goal: z.string(),
  status: projectStatusSchema,
  status_note: z.string().nullable(),
  next_step: z.string().nullable(),
  tech_stack: z.array(z.string()),
  links: z.record(z.string(), z.string()),
  metadata: z.record(z.string(), z.unknown()),
  search_embedding: embeddingSchema,
  pinned: z.boolean(),
  archived: z.boolean(),
  needs_review: z.boolean(),
  user_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const decaySchema = z.enum(['fresh', 'stale', 'fossil']);
export type Decay = z.infer<typeof decaySchema>;

export const derivedProjectSchema = projectSchema.extend({
  live: z.boolean(),
  decay: decaySchema,
});
export type DerivedProject = z.infer<typeof derivedProjectSchema>;
