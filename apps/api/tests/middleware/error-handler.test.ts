import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { AppError } from '../../src/errors.js';

describe('error handler', () => {
  let stack: TestStack;
  beforeAll(async () => {
    stack = await startTestServer();
    stack.app.get('/test/app-err', async () => {
      throw new AppError('NOT_FOUND', 404, 'thing not found');
    });
    stack.app.get('/test/unknown', async () => {
      throw new Error('something else');
    });
    await stack.app.ready();
  });
  afterAll(async () => {
    await stack.cleanup();
  });

  it('echoes incoming X-Request-ID', async () => {
    const res = await stack.app.inject({
      method: 'GET',
      url: '/v1/healthz',
      headers: { 'x-request-id': 'req-abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('req-abc-123');
  });

  it('generates X-Request-ID when missing', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/v1/healthz' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('formats AppError correctly', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/test/app-err' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('thing not found');
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('maps unknown errors to 500 INTERNAL without leaking details', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/test/unknown' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error).toBe('INTERNAL');
    expect(body.message).toBe('internal server error');
    expect(body.message).not.toContain('something else');
  });
});
