import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { makeAgentProjects } from '../../services/agent-projects.js';

const heartbeatInput = z.object({ path: z.string().min(1) });

export const heartbeatRoute: FastifyPluginAsyncZod = async function heartbeatRoute(app) {
  app.post('/heartbeat', {
    schema: { body: heartbeatInput },
  }, async (req) => {
    const svc = makeAgentProjects({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.heartbeat(req.body.path);
  });
}
