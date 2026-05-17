import { eq, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';

export type NoteRow = typeof schema.projectNotes.$inferSelect;
export type NoteInsert = typeof schema.projectNotes.$inferInsert;

export async function insertNote(
  tx: NodePgDatabase<typeof schema>,
  values: NoteInsert,
): Promise<NoteRow> {
  const rows = await tx.insert(schema.projectNotes).values(values).returning();
  return rows[0]!;
}

export async function listNotesByProject(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
): Promise<NoteRow[]> {
  return db
    .select()
    .from(schema.projectNotes)
    .where(eq(schema.projectNotes.project_id, projectId))
    .orderBy(desc(schema.projectNotes.created_at));
}

export async function listRecentNotesByProject(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
  limit: number,
): Promise<NoteRow[]> {
  return db
    .select()
    .from(schema.projectNotes)
    .where(eq(schema.projectNotes.project_id, projectId))
    .orderBy(desc(schema.projectNotes.created_at))
    .limit(limit);
}
