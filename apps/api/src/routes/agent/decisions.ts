import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { addDecisionInputSchema, supersedeDecisionInputSchema } from '@foundry/shared';
import { makeAgentDecisions } from '../../services/agent-decisions.js';

export const decisionsRoutes: FastifyPluginAsyncZod = async function decisionsRoutes(app) {
  app.post('/decisions', {
    schema: { body: addDecisionInputSchema },
  }, async (req) => {
    const svc = makeAgentDecisions({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.add(req.body);
  });

  app.post('/decisions/supersede', {
    schema: { body: supersedeDecisionInputSchema },
  }, async (req) => {
    const svc = makeAgentDecisions({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.supersede(req.body);
  });
}
