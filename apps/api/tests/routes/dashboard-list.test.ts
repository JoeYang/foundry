import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';

const mkProj = (path: string, name: string, extras: Record<string, unknown> = {}) => ({
  path,
  name,
  summary: 's',
  goal: '',
  tech_stack: [],
  links: {},
  metadata: {},
  actor: 'agent:test' as const,
  ...extras,
});

async function upsert(stack: TestStack, payload: Record<string, unknown>) {
  return stack.app.inject({
    method: 'POST',
    url: '/v1/agent/projects/upsert',
    payload,
  });
}

describe('GET /v1/projects', () => {
  let stack: TestStack;
  beforeAll(async () => {
    stack = await startTestServer();
  });
  afterAll(async () => {
    await stack.cleanup();
  });

  it('returns empty array on empty DB', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/v1/projects' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 3 projects with live + decay derivation', async () => {
    await upsert(stack, mkProj('/list/a', 'A', { status: 'active' }));
    await upsert(stack, mkProj('/list/b', 'B', { status: 'paused' }));
    await upsert(stack, mkProj('/list/c', 'C', { status: 'done' }));
    const res = await stack.app.inject({ method: 'GET', url: '/v1/projects' });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r).toHaveProperty('live');
      expect(r).toHaveProperty('decay');
      expect(['fresh', 'stale', 'fossil']).toContain(r.decay);
    }
  });

  it('filters by status', async () => {
    const res = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects?status=active',
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows.every((r: { status: string }) => r.status === 'active')).toBe(true);
  });

  it('excludes archived by default', async () => {
    // Default behavior: include_archived=false, so all returned rows must have archived === false
    const res = await stack.app.inject({ method: 'GET', url: '/v1/projects' });
    const rows = res.json();
    expect(rows.every((r: { archived: boolean }) => r.archived === false)).toBe(true);
  });

  it('search by name (fuzzy via ILIKE)', async () => {
    const res = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects?search=A',
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r: { name: string }) => r.name === 'A')).toBe(true);
  });

  it('rejects unknown sort value', async () => {
    const res = await stack.app.inject({
      method: 'GET',
      url: '/v1/projects?sort=random',
    });
    expect(res.statusCode).toBe(400);
  });
});
