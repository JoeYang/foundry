import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';

async function upsert(stack: TestStack, payload: Record<string, unknown>) {
  return stack.app.inject({ method: 'POST', url: '/v1/agent/projects/upsert', payload });
}

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

describe('GET /v1/projects/:slug', () => {
  let stack: TestStack;
  beforeAll(async () => {
    stack = await startTestServer();
  });
  afterAll(async () => {
    await stack.cleanup();
  });

  it('404 for unknown slug', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/v1/projects/never' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NOT_FOUND');
  });

  it('returns project with live + decay', async () => {
    await upsert(stack, mkProj('/det/p1', 'Det P1'));
    const res = await stack.app.inject({ method: 'GET', url: '/v1/projects/det-p1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slug).toBe('det-p1');
    expect(body).toHaveProperty('live');
    expect(body).toHaveProperty('decay');
  });

  it('GET /v1/projects/:slug/timeline returns merged stream', async () => {
    await upsert(stack, mkProj('/det/p2', 'Det P2'));
    // Add a decision
    await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/decisions',
      payload: {
        path: '/det/p2',
        title: 't',
        rationale: 'r',
        actor: 'agent:test',
      },
    });
    // Add a todo
    await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/todos',
      payload: { path: '/det/p2', text: 'x', actor: 'agent:test' },
    });
    const res = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects/det-p2/timeline',
    });
    expect(res.statusCode).toBe(200);
    const items = res.json();
    const kinds = items.map((i: { kind: string }) => i.kind);
    expect(kinds).toContain('event');
    expect(kinds).toContain('decision');
    expect(kinds).toContain('todo');
  });

  it('GET aspect routes return correct shape', async () => {
    await upsert(stack, mkProj('/det/p3', 'Det P3'));
    await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/decisions',
      payload: { path: '/det/p3', title: 't', rationale: 'r', actor: 'agent:test' },
    });

    const decRes = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects/det-p3/decisions',
    });
    expect(decRes.statusCode).toBe(200);
    expect(decRes.json()).toHaveLength(1);

    const todoRes = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects/det-p3/todos',
    });
    expect(todoRes.statusCode).toBe(200);

    const noteRes = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects/det-p3/notes',
    });
    expect(noteRes.statusCode).toBe(200);
  });

  it('404 for timeline on unknown slug', async () => {
    const res = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects/unknown-slug-xyz/timeline',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NOT_FOUND');
  });

  it('404 for decisions on unknown slug', async () => {
    const res = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects/unknown-slug-xyz/decisions',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NOT_FOUND');
  });
});
