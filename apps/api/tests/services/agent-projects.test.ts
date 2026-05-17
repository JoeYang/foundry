import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { makeAgentProjects } from '../../src/services/agent-projects.js';
import { schema } from '@foundry/db';
import { eq } from 'drizzle-orm';

describe('agent-projects service', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  const svc = () => makeAgentProjects({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });

  it('upsert creates a project + emits created event', async () => {
    const project = await svc().upsert({
      path: '/test/new-project',
      name: 'New Project',
      summary: 'a summary',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:test',
    });
    expect(project.slug).toBe('new-project');
    expect(project.status).toBe('active');

    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.project_id, project.id));
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('created');
  });

  it('upsert with existing path updates tracked fields + emits per-field events', async () => {
    await svc().upsert({
      path: '/test/update-me',
      name: 'Update Me',
      summary: 'first',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:test',
    });
    const updated = await svc().upsert({
      path: '/test/update-me',
      name: 'Update Me',
      summary: 'second',
      status: 'blocked',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:test',
    });
    expect(updated.summary).toBe('second');
    expect(updated.status).toBe('blocked');

    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.project_id, updated.id));
    const kinds = events.map((e) => e.kind).sort();
    expect(kinds).toEqual(['created', 'status_changed', 'summary_changed']);
  });

  it('slug collisions append -2', async () => {
    await svc().upsert({ path: '/test/slug1', name: 'Collide', summary: 's', goal: '', tech_stack: [], links: {}, metadata: {}, actor: 'agent:test' });
    const second = await svc().upsert({ path: '/test/slug2', name: 'Collide', summary: 's', goal: '', tech_stack: [], links: {}, metadata: {}, actor: 'agent:test' });
    expect(second.slug).toBe('collide-2');
  });

  it('setStatus emits status_changed and updates row', async () => {
    const created = await svc().upsert({
      path: '/test/setstatus',
      name: 'SetStatus',
      summary: 's',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:test',
    });
    const updated = await svc().setStatus({
      path: '/test/setstatus',
      status: 'paused',
      note: 'taking a break',
      actor: 'agent:test',
    });
    expect(updated.status).toBe('paused');
    expect(updated.status_note).toBe('taking a break');

    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.project_id, created.id));
    expect(events.map((e) => e.kind).sort()).toEqual(['created', 'status_changed']);
  });

  it('setStatus is a no-op when status unchanged', async () => {
    const created = await svc().upsert({
      path: '/test/noop',
      name: 'NoOp',
      summary: 's',
      status: 'active',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:test',
    });
    await svc().setStatus({
      path: '/test/noop',
      status: 'active',
      actor: 'agent:test',
    });
    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.project_id, created.id));
    expect(events).toHaveLength(1);
  });

  it('heartbeat throws NOT_FOUND for unknown path', async () => {
    await expect(svc().heartbeat('/never/seen')).rejects.toThrow(/no project at path/);
  });

  it('setNextStep emits next_step_changed', async () => {
    await svc().upsert({
      path: '/test/nextstep',
      name: 'NextStep',
      summary: 's',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:test',
    });
    const updated = await svc().setNextStep({
      path: '/test/nextstep',
      next_step: 'write tests',
      actor: 'agent:test',
    });
    expect(updated.next_step).toBe('write tests');
  });
});
