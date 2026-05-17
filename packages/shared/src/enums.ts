import { z } from 'zod';

export const PROJECT_STATUSES = ['active', 'paused', 'blocked', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const projectStatusSchema = z.enum(PROJECT_STATUSES);

export const TODO_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];
export const todoStatusSchema = z.enum(TODO_STATUSES);

export const PROJECT_EVENT_KINDS = [
  'created',
  'status_changed',
  'next_step_changed',
  'summary_changed',
  'goal_changed',
  'links_changed',
  'tech_stack_changed',
  'human_flag_changed',
] as const;
export type ProjectEventKind = (typeof PROJECT_EVENT_KINDS)[number];
export const projectEventKindSchema = z.enum(PROJECT_EVENT_KINDS);

// actor strings must be 'agent:<name>' or 'human:<name>' with a non-empty name
export const actorSchema = z
  .string()
  .regex(/^(agent|human):.+$/, 'actor must be "agent:<name>" or "human:<name>"');
export type Actor = z.infer<typeof actorSchema>;
