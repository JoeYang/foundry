import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const projectNotes = pgTable(
  'project_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    author: text('author').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_notes_project_time').on(t.project_id, t.created_at.desc())],
);
