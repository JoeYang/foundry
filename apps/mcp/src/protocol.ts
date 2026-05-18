import type { FastifyInstance } from 'fastify';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { type ToolDef, buildTools } from './tools.js';

/**
 * Build a fresh MCP Server wired to a new stateless transport.
 *
 * The StreamableHTTPServerTransport in stateless mode (no sessionIdGenerator)
 * is single-use: it throws if handleRequest is called more than once on the
 * same instance. We therefore create a new Server+Transport pair per HTTP
 * request, sharing only the resolved tool list.
 */
function buildMcpServer(tools: ToolDef[]): {
  server: Server;
  transport: StreamableHTTPServerTransport;
} {
  const server = new Server(
    { name: 'foundry', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t): Tool => ({
      name: t.name,
      description: t.description,
      // zodToJsonSchema returns JSON Schema 7; MCP expects an object schema
      inputSchema: zodToJsonSchema(t.inputSchema, {
        target: 'jsonSchema7',
      }) as Tool['inputSchema'],
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `tool ${req.params.name} not found` }],
      };
    }
    try {
      const result = await tool.handler(req.params.arguments ?? {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: msg }],
      };
    }
  });

  // Stateless transport — omit sessionIdGenerator to disable session management.
  // IMPORTANT: this transport is single-use; a new instance must be created per request.
  const transport = new StreamableHTTPServerTransport();

  return { server, transport };
}

export async function mcpProtocolPlugin(app: FastifyInstance): Promise<void> {
  // Build the tool list once (it depends on app.deps which is stable)
  const tools = buildTools(app);

  async function handleMcpRequest(
    req: import('fastify').FastifyRequest<{ Body: unknown }>,
    reply: import('fastify').FastifyReply,
  ): Promise<void> {
    const { server, transport } = buildMcpServer(tools);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await server.connect(transport as any);
    try {
      await transport.handleRequest(req.raw, reply.raw, req.body as Record<string, unknown>);
    } finally {
      // Clean up to avoid resource leaks
      await server.close();
    }
  }

  // Mount on the prefix root (/, which becomes /mcp once registered with that prefix)
  app.post<{ Body: unknown }>('/', handleMcpRequest);
  app.get('/', handleMcpRequest);
  app.delete('/', handleMcpRequest);
}
