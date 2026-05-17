import { eq, and, isNull, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';

export type DecisionRow = typeof schema.projectDecisions.$inferSelect;
export type DecisionInsert = typeof schema.projectDecisions.$inferInsert;

export async function insertDecision(
  tx: NodePgDatabase<typeof schema>,
  values: DecisionInsert,
): Promise<DecisionRow> {
  const rows = await tx.insert(schema.projectDecisions).values(values).returning();
  return rows[0]!;
}

export async function findDecisionById(
  db: NodePgDatabase<typeof schema>,
  id: string,
): Promise<DecisionRow | undefined> {
  const rows = await db
    .select()
    .from(schema.projectDecisions)
    .where(eq(schema.projectDecisions.id, id))
    .limit(1);
  return rows[0];
}

export async function listDecisionsByProject(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
  opts: { currentOnly?: boolean } = {},
): Promise<DecisionRow[]> {
  const where = opts.currentOnly
    ? and(
        eq(schema.projectDecisions.project_id, projectId),
        isNull(schema.projectDecisions.superseded_by),
      )
    : eq(schema.projectDecisions.project_id, projectId);
  return db
    .select()
    .from(schema.projectDecisions)
    .where(where)
    .orderBy(desc(schema.projectDecisions.made_at));
}

export async function markDecisionSuperseded(
  tx: NodePgDatabase<typeof schema>,
  priorId: string,
  newId: string,
): Promise<void> {
  await tx
    .update(schema.projectDecisions)
    .set({ superseded_by: newId })
    .where(eq(schema.projectDecisions.id, priorId));
}
