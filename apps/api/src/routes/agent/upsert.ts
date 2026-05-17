import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { upsertProjectInputSchema } from '@foundry/shared';
import { makeAgentProjects } from '../../services/agent-projects.js';

export const upsertRoute: FastifyPluginAsyncZod = async function upsertRoute(app) {
  app.post('/upsert', {
    schema: { body: upsertProjectInputSchema },
  }, async (req) => {
    const svc = makeAgentProjects({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.upsert(req.body);
  });
}
