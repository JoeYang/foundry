import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../../api/tests/helpers/test-server.js';

describe('mcp protocol (real MCP via SDK)', () => {
  let stack: TestStack;
  beforeAll(async () => {
    stack = await startTestServer();
  });
  afterAll(async () => {
    await stack.cleanup();
  });

  it('initialize handshake returns server info + tools capability', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      },
    });
    expect(res.statusCode).toBe(200);
    // Response is either JSON or SSE-framed JSON; both should contain the server info
    const text = res.body;
    expect(text).toContain('"name":"foundry"');
    expect(text).toContain('tools');
  });

  it('tools/list returns all 10 tool names', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    });
    expect(res.statusCode).toBe(200);
    const text = res.body;
    expect(text).toContain('upsert_project');
    expect(text).toContain('heartbeat');
    expect(text).toContain('get_project');
    expect(text).toContain('set_status');
    expect(text).toContain('set_next_step');
    expect(text).toContain('add_decision');
    expect(text).toContain('supersede_decision');
    expect(text).toContain('add_todo');
    expect(text).toContain('update_todo');
    expect(text).toContain('add_note');
  });

  it('tools/call upsert_project creates a project and returns slug', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'upsert_project',
          arguments: {
            path: '/mcp/protocol-test',
            name: 'protocol test',
            summary: 'testing the protocol plugin',
            actor: 'agent:protocol-test',
          },
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const text = res.body;
    expect(text).toContain('protocol-test');
  });

  it('tools/call with unknown tool returns isError response', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {},
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const text = res.body;
    expect(text).toContain('not found');
  });

  it('tools/call with invalid arguments returns isError with validation message', async () => {
    const res = await stack.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'upsert_project',
          arguments: { path: '/only-path' }, // missing required name, summary, actor
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const text = res.body;
    // Zod validation error returns isError=true with a message
    expect(text).toContain('isError');
  });
});
