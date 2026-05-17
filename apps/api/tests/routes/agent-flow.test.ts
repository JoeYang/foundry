import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';

describe('agent flow end-to-end', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  it('full lifecycle: upsert → status → decision → todo → update todo → note → get', async () => {
    // 1. Upsert
    const upsertRes = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/upsert',
      payload: {
        path: '/flow/p1', name: 'Flow', summary: 's', actor: 'agent:test',
      },
    });
    expect(upsertRes.statusCode).toBe(200);

    // 2. Set status
    const statusRes = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/status',
      payload: { path: '/flow/p1', status: 'blocked', note: 'pg crashed', actor: 'agent:test' },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().status).toBe('blocked');

    // 3. Add decision
    const decRes = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/decisions',
      payload: {
        path: '/flow/p1',
        title: 'use Drizzle',
        rationale: 'lighter',
        actor: 'agent:test',
      },
    });
    expect(decRes.statusCode).toBe(200);

    // 4. Add todo
    const todoRes = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/todos',
      payload: { path: '/flow/p1', text: 'write tests', actor: 'agent:test' },
    });
    expect(todoRes.statusCode).toBe(200);
    const todoId = todoRes.json().id;

    // 5. Update todo to done
    const updRes = await stack.app.inject({
      method: 'PATCH',
      url: `/v1/agent/projects/todos/${todoId}`,
      payload: { status: 'done' },
    });
    expect(updRes.statusCode).toBe(200);
    expect(updRes.json().status).toBe('done');

    // 6. Add note
    const noteRes = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/notes',
      payload: { path: '/flow/p1', body: 'wrapped up', author: 'human:joeyang' },
    });
    expect(noteRes.statusCode).toBe(200);

    // 7. Get
    const getRes = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/get',
      payload: { path: '/flow/p1' },
    });
    expect(getRes.statusCode).toBe(200);
    const got = getRes.json();
    expect(got.project.path).toBe('/flow/p1');
    expect(got.recent_events.length).toBeGreaterThanOrEqual(2); // at least created + status_changed
    expect(got.current_decisions).toHaveLength(1);
    expect(got.open_todos).toHaveLength(0); // the only todo is done
    expect(got.recent_notes).toHaveLength(1);
  });

  it('heartbeat without an existing project returns 404', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/heartbeat',
      payload: { path: '/no/such/path' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NOT_FOUND');
  });
});
