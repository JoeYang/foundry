import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { createTestSchema } from './helpers.js';

const APP_URL =
  process.env.DB_URL_APP ?? 'postgres://foundry_app:foundry_app@localhost:5433/foundry';

describe('append-only role enforcement', () => {
  let ctx: Awaited<ReturnType<typeof createTestSchema>>;
  let appPool: pg.Pool;
  let projectId: string;

  beforeAll(async () => {
    ctx = await createTestSchema();
    appPool = new pg.Pool({ connectionString: APP_URL });
    appPool.on('connect', (c) => {
      c.query(`SET search_path TO "${ctx.schemaName}", public`);
    });

    // Seed one project so we have child rows to attempt to mutate.
    const p = await ctx.pool.query<{ id: string }>(
      `INSERT INTO projects (path, slug, name, summary) VALUES ($1,$2,$3,$4) RETURNING id`,
      ['/seed', 'seed', 'seed', 'seed'],
    );
    projectId = p.rows[0]!.id;
    await ctx.pool.query(
      `INSERT INTO project_events (project_id, kind, payload, actor) VALUES ($1,'created','{}','agent:test')`,
      [projectId],
    );
    await ctx.pool.query(
      `INSERT INTO project_decisions (project_id, title, rationale, made_by) VALUES ($1,'t','r','agent:test')`,
      [projectId],
    );
    await ctx.pool.query(
      `INSERT INTO project_notes (project_id, body, author) VALUES ($1,'note','agent:test')`,
      [projectId],
    );
    await ctx.pool.query(
      `INSERT INTO project_todos (project_id, text, added_by) VALUES ($1,'todo','agent:test')`,
      [projectId],
    );
  }, 30_000);

  afterAll(async () => {
    await appPool.end();
    await ctx.close();
  });

  it('foundry_app can SELECT project_events', async () => {
    const { rows } = await appPool.query(`SELECT count(*) FROM project_events`);
    expect(rows[0].count).toBe('1');
  });

  it('foundry_app can INSERT into project_events', async () => {
    await expect(
      appPool.query(
        `INSERT INTO project_events (project_id, kind, payload, actor) VALUES ($1,'status_changed','{}','agent:test')`,
        [projectId],
      ),
    ).resolves.toBeDefined();
  });

  it('foundry_app CANNOT UPDATE project_events', async () => {
    await expect(
      appPool.query(`UPDATE project_events SET actor='hacker' WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT DELETE from project_events', async () => {
    await expect(
      appPool.query(`DELETE FROM project_events WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT UPDATE project_decisions', async () => {
    await expect(
      appPool.query(`UPDATE project_decisions SET title='x' WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT DELETE project_decisions', async () => {
    await expect(
      appPool.query(`DELETE FROM project_decisions WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT UPDATE project_notes', async () => {
    await expect(
      appPool.query(`UPDATE project_notes SET body='x' WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT DELETE project_notes', async () => {
    await expect(
      appPool.query(`DELETE FROM project_notes WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CAN UPDATE project_todos (mutable status)', async () => {
    await expect(
      appPool.query(`UPDATE project_todos SET status='done', completed_at=now() WHERE project_id = $1`, [projectId]),
    ).resolves.toBeDefined();
  });

  it('foundry_app CAN UPDATE projects (mutable current state)', async () => {
    await expect(
      appPool.query(`UPDATE projects SET name='renamed' WHERE id = $1`, [projectId]),
    ).resolves.toBeDefined();
  });
});
