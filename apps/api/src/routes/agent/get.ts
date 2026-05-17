import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { makeAgentGet } from '../../services/agent-get.js';

const getInput = z.object({ path: z.string().min(1) });

export const getRoute: FastifyPluginAsyncZod = async function getRoute(app) {
  app.post('/get', {
    schema: { body: getInput },
  }, async (req) => {
    const svc = makeAgentGet({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.get(req.body.path);
  });
}
