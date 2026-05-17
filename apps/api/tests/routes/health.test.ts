import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';

describe('GET /v1/healthz', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  it('returns ok', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/v1/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /v1/livez', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  it('returns ok when db reachable', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/v1/livez' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
