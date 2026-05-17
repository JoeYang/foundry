import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { makeAgentProjects } from '../../src/services/agent-projects.js';
import { makeAgentTodos } from '../../src/services/agent-todos.js';

const mkProj = (path: string, name: string) => ({
  path, name, summary: 's', goal: '', tech_stack: [], links: {}, metadata: {},
  actor: 'agent:test' as const,
});

describe('agent-todos service', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  const projects = () => makeAgentProjects({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });
  const todos = () => makeAgentTodos({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });

  it('add inserts a new todo with status=open', async () => {
    await projects().upsert(mkProj('/todos/p1', 'P1'));
    const t = await todos().add({ path: '/todos/p1', text: 'do thing', actor: 'agent:test' });
    expect(t.text).toBe('do thing');
    expect(t.status).toBe('open');
    expect(t.completed_at).toBeNull();
  });

  it('add throws NOT_FOUND for unknown path', async () => {
    await expect(todos().add({
      path: '/never', text: 't', actor: 'agent:test',
    })).rejects.toThrow(/no project at path/);
  });

  it('update transitions open → in_progress (no completed_at)', async () => {
    await projects().upsert(mkProj('/todos/p2', 'P2'));
    const t = await todos().add({ path: '/todos/p2', text: 'x', actor: 'agent:test' });
    const updated = await todos().update(t.id, { status: 'in_progress' });
    expect(updated.status).toBe('in_progress');
    expect(updated.completed_at).toBeNull();
  });

  it('update to done sets completed_at', async () => {
    await projects().upsert(mkProj('/todos/p3', 'P3'));
    const t = await todos().add({ path: '/todos/p3', text: 'x', actor: 'agent:test' });
    const updated = await todos().update(t.id, { status: 'done' });
    expect(updated.status).toBe('done');
    expect(updated.completed_at).not.toBeNull();
  });

  it('update to cancelled does NOT set completed_at', async () => {
    await projects().upsert(mkProj('/todos/p4', 'P4'));
    const t = await todos().add({ path: '/todos/p4', text: 'x', actor: 'agent:test' });
    const updated = await todos().update(t.id, { status: 'cancelled' });
    expect(updated.status).toBe('cancelled');
    expect(updated.completed_at).toBeNull();
  });

  it('update throws NOT_FOUND for unknown todo id', async () => {
    await expect(todos().update('00000000-0000-0000-0000-000000000099', { status: 'done' }))
      .rejects.toThrow(/no todo with id/);
  });
});
