import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';

export type ProjectRow = typeof schema.projects.$inferSelect;
export type ProjectInsert = typeof schema.projects.$inferInsert;

export async function findProjectByPath(
  db: NodePgDatabase<typeof schema>,
  path: string,
): Promise<ProjectRow | undefined> {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.path, path))
    .limit(1);
  return rows[0];
}

export async function findProjectBySlug(
  db: NodePgDatabase<typeof schema>,
  slug: string,
): Promise<ProjectRow | undefined> {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .limit(1);
  return rows[0];
}

export async function slugExists(
  db: NodePgDatabase<typeof schema>,
  slug: string,
): Promise<boolean> {
  const r = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .limit(1);
  return r.length > 0;
}

export async function insertProject(
  db: NodePgDatabase<typeof schema>,
  values: ProjectInsert,
): Promise<ProjectRow> {
  const rows = await db.insert(schema.projects).values(values).returning();
  return rows[0]!;
}

export async function updateProjectById(
  db: NodePgDatabase<typeof schema>,
  id: string,
  patch: Partial<ProjectInsert>,
): Promise<ProjectRow> {
  const rows = await db
    .update(schema.projects)
    .set(patch)
    .where(eq(schema.projects.id, id))
    .returning();
  return rows[0]!;
}

export async function deleteProjectBySlug(
  db: NodePgDatabase<typeof schema>,
  slug: string,
): Promise<number> {
  const rows = await db
    .delete(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .returning({ id: schema.projects.id });
  return rows.length;
}
