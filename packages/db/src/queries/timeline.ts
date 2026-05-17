import { eq, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';

export type ProjectEventRow = typeof schema.projectEvents.$inferSelect;

export async function listRecentEvents(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
  limit: number,
): Promise<ProjectEventRow[]> {
  return db
    .select()
    .from(schema.projectEvents)
    .where(eq(schema.projectEvents.project_id, projectId))
    .orderBy(desc(schema.projectEvents.occurred_at))
    .limit(limit);
}
