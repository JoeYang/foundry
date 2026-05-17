import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { upsertRoute } from './upsert.js';
import { heartbeatRoute } from './heartbeat.js';
import { statusRoute } from './status.js';
import { nextStepRoute } from './next-step.js';
import { decisionsRoutes } from './decisions.js';
import { todosRoutes } from './todos.js';
import { notesRoute } from './notes.js';
import { getRoute } from './get.js';

export const agentRoutes: FastifyPluginAsyncZod = async function agentRoutes(app) {
  // All under /projects under whatever prefix the parent registered with
  await app.register(async (scope) => {
    await scope.register(upsertRoute);
    await scope.register(heartbeatRoute);
    await scope.register(statusRoute);
    await scope.register(nextStepRoute);
    await scope.register(decisionsRoutes);
    await scope.register(todosRoutes);
    await scope.register(notesRoute);
    await scope.register(getRoute);
  }, { prefix: '/projects' });
}
