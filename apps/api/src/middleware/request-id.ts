import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'crypto';

async function requestIdPluginImpl(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    (req as { requestId?: string }).requestId = requestId;
    reply.header('x-request-id', requestId);
  });
}

export const requestIdPlugin = fp(requestIdPluginImpl, { name: 'request-id' });

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}
