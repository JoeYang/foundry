import { pgTable, uuid, text, pgEnum, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const projectEventKindEnum = pgEnum('project_event_kind', [
  'created',
  'status_changed',
  'next_step_changed',
  'summary_changed',
  'goal_changed',
  'links_changed',
  'tech_stack_changed',
  'human_flag_changed',
]);

export const projectEvents = pgTable(
  'project_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: projectEventKindEnum('kind').notNull(),
    payload: jsonb('payload').notNull(),
    actor: text('actor').notNull(),
    occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('project_events_timeline').on(t.project_id, t.occurred_at.desc()),
    index('project_events_kind').on(t.kind, t.occurred_at.desc()),
  ],
);
