import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';
import type { ProjectEventKind } from '@foundry/shared';

export async function insertEvent(
  tx: NodePgDatabase<typeof schema>,
  projectId: string,
  kind: ProjectEventKind,
  payload: Record<string, unknown>,
  actor: string,
): Promise<void> {
  await tx.insert(schema.projectEvents).values({
    project_id: projectId,
    kind,
    payload,
    actor,
  });
}
