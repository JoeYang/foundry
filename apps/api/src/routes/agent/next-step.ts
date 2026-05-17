import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { setNextStepInputSchema } from '@foundry/shared';
import { makeAgentProjects } from '../../services/agent-projects.js';

export const nextStepRoute: FastifyPluginAsyncZod = async function nextStepRoute(app) {
  app.post('/next-step', {
    schema: { body: setNextStepInputSchema },
  }, async (req) => {
    const svc = makeAgentProjects({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.setNextStep(req.body);
  });
}
