import { pgTable, uuid, text, pgEnum, timestamp, boolean, jsonb, check, index, vector } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const projectStatusEnum = pgEnum('project_status', ['active', 'paused', 'blocked', 'done']);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    path: text('path').notNull().unique(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    summary: text('summary').notNull(),
    goal: text('goal').notNull().default(''),
    status: projectStatusEnum('status').notNull().default('active'),
    status_note: text('status_note'),
    next_step: text('next_step'),
    tech_stack: text('tech_stack').array().notNull().default(sql`'{}'::text[]`),
    links: jsonb('links').notNull().default(sql`'{}'::jsonb`),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    search_embedding: vector('search_embedding', { dimensions: 1536 }),
    pinned: boolean('pinned').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    needs_review: boolean('needs_review').notNull().default(false),
    user_notes: text('user_notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('summary_length', sql`length(${t.summary}) <= 280`),
    index('projects_dashboard').on(t.archived, t.pinned.desc(), t.updated_at.desc()),
    index('projects_status').on(t.status).where(sql`archived = false`),
    index('projects_name_trgm').using('gin', sql`${t.name} gin_trgm_ops`),
  ],
);
