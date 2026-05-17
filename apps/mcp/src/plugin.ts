import type { FastifyInstance } from 'fastify';
import { buildTools, type ToolDef } from './tools.js';

export async function mcpPlugin(app: FastifyInstance): Promise<void> {
  const tools = buildTools(app);
  const byName = new Map<string, ToolDef>(tools.map((t) => [t.name, t]));

  app.get('/tools', async () => ({
    tools: tools.map(({ name, description }) => ({ name, description })),
  }));

  app.post<{ Params: { name: string }; Body: unknown }>(
    '/tools/:name',
    async (req, reply) => {
      const tool = byName.get(req.params.name);
      if (!tool) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `tool ${req.params.name} not found`,
          request_id: req.requestId,
        });
      }
      return tool.handler(req.body);
    },
  );
}
