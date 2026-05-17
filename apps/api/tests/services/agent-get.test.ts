import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { makeAgentProjects } from '../../src/services/agent-projects.js';
import { makeAgentDecisions } from '../../src/services/agent-decisions.js';
import { makeAgentTodos } from '../../src/services/agent-todos.js';
import { makeAgentNotes } from '../../src/services/agent-notes.js';
import { makeAgentGet } from '../../src/services/agent-get.js';

const mkProj = (path: string, name: string) => ({
  path, name, summary: 's', goal: '', tech_stack: [], links: {}, metadata: {},
  actor: 'agent:test' as const,
});

describe('agent-get service', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  const deps = () => ({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });
  const projects = () => makeAgentProjects(deps());
  const decisions = () => makeAgentDecisions(deps());
  const todos = () => makeAgentTodos(deps());
  const notes = () => makeAgentNotes(deps());
  const getSvc = () => makeAgentGet(deps());

  it('throws NOT_FOUND for unknown path', async () => {
    await expect(getSvc().get('/nope')).rejects.toThrow(/no project at path/);
  });

  it('returns rich payload for a populated project', async () => {
    // Seed: project + 2 decisions (1 superseded) + 3 todos (1 done, 1 open, 1 in_progress) + 2 notes
    await projects().upsert(mkProj('/get/p1', 'P1'));
    const d1 = await decisions().add({
      path: '/get/p1', title: 'use Drizzle', rationale: 'lighter', actor: 'agent:test',
    });
    await decisions().supersede({
      path: '/get/p1',
      prior_id: d1.id,
      title: 'use Prisma',
      rationale: 'reconsidered',
      actor: 'agent:test',
    });
    const t1 = await todos().add({ path: '/get/p1', text: 't1', actor: 'agent:test' });
    const t2 = await todos().add({ path: '/get/p1', text: 't2', actor: 'agent:test' });
    await todos().add({ path: '/get/p1', text: 't3', actor: 'agent:test' });
    await todos().update(t1.id, { status: 'done' });
    await todos().update(t2.id, { status: 'in_progress' });
    await notes().add({ path: '/get/p1', body: 'first', author: 'human:joeyang' });
    await notes().add({ path: '/get/p1', body: 'second', author: 'human:joeyang' });

    const result = await getSvc().get('/get/p1');

    expect(result.project.path).toBe('/get/p1');

    // 1 created + status_changed events possible. At minimum, 1 event (created from upsert).
    expect(result.recent_events.length).toBeGreaterThanOrEqual(1);
    expect(result.recent_events.length).toBeLessThanOrEqual(10);

    // Current decisions: only the latest (Prisma); the Drizzle one is superseded
    expect(result.current_decisions).toHaveLength(1);
    expect(result.current_decisions[0]!.title).toBe('use Prisma');

    // Open todos: t2 (in_progress) and t3 (open). t1 (done) excluded.
    expect(result.open_todos).toHaveLength(2);
    const openTexts = result.open_todos.map((t) => t.text).sort();
    expect(openTexts).toEqual(['t2', 't3']);

    // Recent notes: 2 (limit 5)
    expect(result.recent_notes).toHaveLength(2);
  });

  it('returns empty arrays for a fresh project', async () => {
    await projects().upsert(mkProj('/get/fresh', 'Fresh'));
    const result = await getSvc().get('/get/fresh');
    expect(result.open_todos).toEqual([]);
    expect(result.current_decisions).toEqual([]);
    expect(result.recent_notes).toEqual([]);
    expect(result.recent_events).toHaveLength(1); // just the created event
    expect(result.recent_events[0]!.kind).toBe('created');
  });
});
