import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';

describe('POST /v1/agent/projects/upsert', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  it('creates a project with minimal payload', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/upsert',
      payload: {
        path: '/test/route',
        name: 'route test',
        summary: 's',
        actor: 'agent:test',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slug).toBe('route-test');
    expect(body.path).toBe('/test/route');
  });

  it('returns 400 with VALIDATION_FAILED for missing field', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/upsert',
      payload: { path: '/x', name: 'n' }, // missing summary + actor
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION_FAILED');
  });

  it('rejects path with null byte', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/upsert',
      payload: {
        path: '/foo\x00bar',
        name: 'n',
        summary: 's',
        actor: 'agent:test',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('subsequent upsert returns updated row', async () => {
    await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/upsert',
      payload: {
        path: '/test/twice',
        name: 'Twice',
        summary: 'first',
        actor: 'agent:test',
      },
    });
    const second = await stack.app.inject({
      method: 'POST',
      url: '/v1/agent/projects/upsert',
      payload: {
        path: '/test/twice',
        name: 'Twice',
        summary: 'second',
        status: 'blocked',
        actor: 'agent:test',
      },
    });
    expect(second.statusCode).toBe(200);
    const body = second.json();
    expect(body.summary).toBe('second');
    expect(body.status).toBe('blocked');
  });
});
