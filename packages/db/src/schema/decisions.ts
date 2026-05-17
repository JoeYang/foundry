import { pgTable, uuid, text, timestamp, jsonb, index, AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects.js';

export const projectDecisions = pgTable(
  'project_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    rationale: text('rationale').notNull(),
    alternatives: jsonb('alternatives').notNull().default(sql`'[]'::jsonb`),
    decision: jsonb('decision').notNull().default(sql`'{}'::jsonb`),
    superseded_by: uuid('superseded_by').references((): AnyPgColumn => projectDecisions.id),
    made_at: timestamp('made_at', { withTimezone: true }).notNull().defaultNow(),
    made_by: text('made_by').notNull(),
  },
  (t) => [
    index('project_decisions_project_time').on(t.project_id, t.made_at.desc()),
    index('project_decisions_current').on(t.project_id).where(sql`superseded_by IS NULL`),
  ],
);
