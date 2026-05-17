import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { makeDashboard } from '../../services/dashboard.js';

const slugParam = z.object({ slug: z.string().min(1) });

export async function timelineRoute(app: FastifyInstance) {
  app.get(
    '/:slug/timeline',
    {
      schema: { params: slugParam },
    },
    async (req) => {
      const svc = makeDashboard({ db: app.deps.db, liveTracker: app.deps.liveTracker });
      return svc.timelineBySlug((req.params as { slug: string }).slug);
    },
  );
}
