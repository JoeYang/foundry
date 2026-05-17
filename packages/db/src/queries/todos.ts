import { eq, and, desc, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';
import type { TodoStatus } from '@foundry/shared';

export type TodoRow = typeof schema.projectTodos.$inferSelect;
export type TodoInsert = typeof schema.projectTodos.$inferInsert;

export async function insertTodo(
  tx: NodePgDatabase<typeof schema>,
  values: TodoInsert,
): Promise<TodoRow> {
  const rows = await tx.insert(schema.projectTodos).values(values).returning();
  return rows[0]!;
}

export async function findTodoById(
  db: NodePgDatabase<typeof schema>,
  id: string,
): Promise<TodoRow | undefined> {
  const rows = await db
    .select()
    .from(schema.projectTodos)
    .where(eq(schema.projectTodos.id, id))
    .limit(1);
  return rows[0];
}

export async function updateTodoStatus(
  tx: NodePgDatabase<typeof schema>,
  id: string,
  status: TodoStatus,
  completedAt: Date | null,
): Promise<TodoRow> {
  const rows = await tx
    .update(schema.projectTodos)
    .set({ status, completed_at: completedAt })
    .where(eq(schema.projectTodos.id, id))
    .returning();
  return rows[0]!;
}

export async function listTodosByProject(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
): Promise<TodoRow[]> {
  return db
    .select()
    .from(schema.projectTodos)
    .where(eq(schema.projectTodos.project_id, projectId))
    .orderBy(desc(schema.projectTodos.added_at));
}

export async function listOpenTodosByProject(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
): Promise<TodoRow[]> {
  return db
    .select()
    .from(schema.projectTodos)
    .where(
      and(
        eq(schema.projectTodos.project_id, projectId),
        inArray(schema.projectTodos.status, ['open', 'in_progress']),
      ),
    )
    .orderBy(desc(schema.projectTodos.added_at));
}
