import { pgTable, uuid, text, pgEnum, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects.js';

export const todoStatusEnum = pgEnum('todo_status', ['open', 'in_progress', 'done', 'cancelled']);

export const projectTodos = pgTable(
  'project_todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    status: todoStatusEnum('status').notNull().default('open'),
    added_at: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    added_by: text('added_by').notNull(),
  },
  (t) => [
    index('project_todos_open')
      .on(t.project_id, t.added_at.desc())
      .where(sql`status IN ('open','in_progress')`),
  ],
);
