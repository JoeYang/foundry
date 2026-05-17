import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSchema, type TestSchemaContext } from './helpers.js';

describe('migrations', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createTestSchema();
  }, 30_000);

  afterAll(async () => {
    await ctx.close();
  });

  it('creates all five application tables', async () => {
    const { rows } = await ctx.pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1
       ORDER BY table_name`,
      [ctx.schemaName],
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual([
      'project_decisions',
      'project_events',
      'project_notes',
      'project_todos',
      'projects',
    ]);
  });

  it('projects has the CHECK constraint on summary length', async () => {
    await expect(
      ctx.pool.query(
        `INSERT INTO projects (path, slug, name, summary) VALUES ($1, $2, $3, $4)`,
        ['/x', 'x', 'x', 'a'.repeat(281)],
      ),
    ).rejects.toThrow(/check/i);
  });

  it('updated_at trigger fires on UPDATE', async () => {
    const insert = await ctx.pool.query<{ id: string; updated_at: Date }>(
      `INSERT INTO projects (path, slug, name, summary)
       VALUES ($1,$2,$3,$4)
       RETURNING id, updated_at`,
      ['/trig', 'trig', 'trig', 'short'],
    );
    const before = insert.rows[0]!.updated_at;

    await new Promise<void>((r) => setTimeout(r, 20));

    const update = await ctx.pool.query<{ updated_at: Date }>(
      `UPDATE projects SET name = 'trig2' WHERE id = $1 RETURNING updated_at`,
      [insert.rows[0]!.id],
    );
    expect(update.rows[0]!.updated_at.getTime()).toBeGreaterThan(before.getTime());
  });

  it('cascade delete removes child rows from all child tables', async () => {
    const p = await ctx.pool.query<{ id: string }>(
      `INSERT INTO projects (path, slug, name, summary)
       VALUES ($1,$2,$3,$4)
       RETURNING id`,
      ['/cascade', 'cascade', 'cascade', 'cascade'],
    );
    const pid = p.rows[0]!.id;

    await ctx.pool.query(
      `INSERT INTO project_events (project_id, kind, payload, actor)
       VALUES ($1, 'created', '{}', 'agent:test')`,
      [pid],
    );
    await ctx.pool.query(
      `INSERT INTO project_todos (project_id, text, added_by)
       VALUES ($1, 't', 'agent:test')`,
      [pid],
    );

    await ctx.pool.query(`DELETE FROM projects WHERE id = $1`, [pid]);

    const ev = await ctx.pool.query<{ count: string }>(
      `SELECT count(*) FROM project_events WHERE project_id = $1`,
      [pid],
    );
    const td = await ctx.pool.query<{ count: string }>(
      `SELECT count(*) FROM project_todos WHERE project_id = $1`,
      [pid],
    );
    expect(ev.rows[0]!.count).toBe('0');
    expect(td.rows[0]!.count).toBe('0');
  });

  it('vector extension is loaded and accepts a 1536-dim vector', async () => {
    const v = `[${new Array(1536).fill(0.5).join(',')}]`;
    const result = await ctx.pool.query<{ id: string }>(
      `INSERT INTO projects (path, slug, name, summary, search_embedding)
       VALUES ($1,$2,$3,$4,$5::vector)
       RETURNING id`,
      ['/vec', 'vec', 'vec', 'vec', v],
    );
    expect(result.rows[0]!.id).toBeDefined();
  });
});
