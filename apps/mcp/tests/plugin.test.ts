import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../../api/tests/helpers/test-server.js';

describe('mcp plugin', () => {
  let stack: TestStack;
  beforeAll(async () => {
    stack = await startTestServer();
  });
  afterAll(async () => {
    await stack.cleanup();
  });

  it('GET /mcp/tools lists all 10 tools', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/mcp/tools' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tools).toHaveLength(10);
    const names = body.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual([
      'add_decision',
      'add_note',
      'add_todo',
      'get_project',
      'heartbeat',
      'set_next_step',
      'set_status',
      'supersede_decision',
      'update_todo',
      'upsert_project',
    ]);
  });

  it('POST /mcp/tools/upsert_project creates a project', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/mcp/tools/upsert_project',
      payload: {
        path: '/mcp/test',
        name: 'mcp test',
        summary: 's',
        actor: 'agent:mcp-test',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe('mcp-test');
  });

  it('POST /mcp/tools/unknown returns 404', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/mcp/tools/never',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NOT_FOUND');
  });

  it('POST with invalid input returns 400 VALIDATION_FAILED', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/mcp/tools/upsert_project',
      payload: { path: '/x' }, // missing required fields
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION_FAILED');
  });

  it('full agent flow via MCP: upsert → add_decision → get_project', async () => {
    await stack.app.inject({
      method: 'POST',
      url: '/mcp/tools/upsert_project',
      payload: {
        path: '/mcp/flow',
        name: 'mcp flow',
        summary: 's',
        actor: 'agent:mcp',
      },
    });
    await stack.app.inject({
      method: 'POST',
      url: '/mcp/tools/add_decision',
      payload: {
        path: '/mcp/flow',
        title: 'choose typescript',
        rationale: 'shared types',
        actor: 'agent:mcp',
      },
    });
    const getRes = await stack.app.inject({
      method: 'POST',
      url: '/mcp/tools/get_project',
      payload: { path: '/mcp/flow' },
    });
    expect(getRes.statusCode).toBe(200);
    const got = getRes.json();
    expect(got.project.slug).toBe('mcp-flow');
    expect(got.current_decisions).toHaveLength(1);
    expect(got.current_decisions[0].title).toBe('choose typescript');
  });
});
