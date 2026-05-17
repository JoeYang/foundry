import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { schema } from '@foundry/db';
import { eq, and } from 'drizzle-orm';

const mkProj = (path: string, name: string) => ({
  path,
  name,
  summary: 's',
  goal: '',
  tech_stack: [],
  links: {},
  metadata: {},
  actor: 'agent:test' as const,
});

async function upsert(stack: TestStack, payload: Record<string, unknown>) {
  return stack.app.inject({ method: 'POST', url: '/v1/agent/projects/upsert', payload });
}

describe('PATCH /v1/projects/:slug/flags', () => {
  let stack: TestStack;
  beforeAll(async () => {
    stack = await startTestServer();
  });
  afterAll(async () => {
    await stack.cleanup();
  });

  it('toggles pinned and emits 1 human_flag_changed event', async () => {
    await upsert(stack, mkProj('/flags/p1', 'P1'));
    const res = await stack.app.inject({
      method: 'PATCH',
      url: '/v1/projects/p1/flags',
      payload: { pinned: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().pinned).toBe(true);

    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.kind, 'human_flag_changed'));
    const flagEvents = events.filter(
      (e) => (e.payload as Record<string, unknown>).flag === 'pinned',
    );
    expect(flagEvents.length).toBeGreaterThan(0);
  });

  it('PATCH with multiple flags emits multiple events', async () => {
    await upsert(stack, mkProj('/flags/p2', 'P2'));
    await stack.app.inject({
      method: 'PATCH',
      url: '/v1/projects/p2/flags',
      payload: { pinned: true, needs_review: true, user_notes: 'hi' },
    });

    const project = (
      await stack.app.deps.db.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.slug, 'p2'))
        .limit(1)
    )[0]!;
    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(
        and(
          eq(schema.projectEvents.project_id, project.id),
          eq(schema.projectEvents.kind, 'human_flag_changed'),
        ),
      );
    expect(events).toHaveLength(3);
    const flagsTouched = events
      .map((e) => (e.payload as Record<string, unknown>).flag)
      .sort();
    expect(flagsTouched).toEqual(['needs_review', 'pinned', 'user_notes']);
  });

  it('empty PATCH body is a no-op (no events)', async () => {
    await upsert(stack, mkProj('/flags/p3', 'P3'));
    const res = await stack.app.inject({
      method: 'PATCH',
      url: '/v1/projects/p3/flags',
      payload: {},
    });
    expect(res.statusCode).toBe(200);

    const project = (
      await stack.app.deps.db.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.slug, 'p3'))
        .limit(1)
    )[0]!;
    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(
        and(
          eq(schema.projectEvents.project_id, project.id),
          eq(schema.projectEvents.kind, 'human_flag_changed'),
        ),
      );
    expect(events).toHaveLength(0);
  });

  it('unchanged flags do not emit events', async () => {
    await upsert(stack, mkProj('/flags/p4', 'P4'));
    // First PATCH sets pinned=true
    await stack.app.inject({
      method: 'PATCH',
      url: '/v1/projects/p4/flags',
      payload: { pinned: true },
    });
    // Second PATCH with same value — no new event
    await stack.app.inject({
      method: 'PATCH',
      url: '/v1/projects/p4/flags',
      payload: { pinned: true },
    });

    const project = (
      await stack.app.deps.db.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.slug, 'p4'))
        .limit(1)
    )[0]!;
    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(
        and(
          eq(schema.projectEvents.project_id, project.id),
          eq(schema.projectEvents.kind, 'human_flag_changed'),
        ),
      );
    expect(events).toHaveLength(1);
  });

  it('PATCH unknown slug returns 404', async () => {
    const res = await stack.app.inject({
      method: 'PATCH',
      url: '/v1/projects/never/flags',
      payload: { pinned: true },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /v1/projects/:slug', () => {
  let stack: TestStack;
  beforeAll(async () => {
    stack = await startTestServer();
  });
  afterAll(async () => {
    await stack.cleanup();
  });

  it('removes project and cascades to children', async () => {
    await upsert(stack, mkProj('/del/p1', 'Del P1'));
    // Add a decision + todo + note
    await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/decisions',
      payload: { path: '/del/p1', title: 't', rationale: 'r', actor: 'agent:test' },
    });
    await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/todos',
      payload: { path: '/del/p1', text: 'x', actor: 'agent:test' },
    });
    await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/notes',
      payload: { path: '/del/p1', body: 'b', author: 'agent:test' },
    });

    const res = await stack.app.inject({ method: 'DELETE', url: '/v1/projects/del-p1' });
    expect(res.statusCode).toBe(204);

    // Verify project is gone
    const remaining = await stack.app.deps.db.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.slug, 'del-p1'));
    expect(remaining).toHaveLength(0);
  });

  it('DELETE unknown slug returns 404', async () => {
    const res = await stack.app.inject({ method: 'DELETE', url: '/v1/projects/never' });
    expect(res.statusCode).toBe(404);
  });
});
