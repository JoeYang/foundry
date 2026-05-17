import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { setStatusInputSchema } from '@foundry/shared';
import { makeAgentProjects } from '../../services/agent-projects.js';

export const statusRoute: FastifyPluginAsyncZod = async function statusRoute(app) {
  app.post('/status', {
    schema: { body: setStatusInputSchema },
  }, async (req) => {
    const svc = makeAgentProjects({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.setStatus(req.body);
  });
}
