import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { makeDashboard } from '../../services/dashboard.js';

const slugParam = z.object({ slug: z.string().min(1) });

export async function aspectsRoutes(app: FastifyInstance) {
  app.get(
    '/:slug/decisions',
    { schema: { params: slugParam } },
    async (req) => {
      const svc = makeDashboard({ db: app.deps.db, liveTracker: app.deps.liveTracker });
      return svc.decisionsBySlug((req.params as { slug: string }).slug);
    },
  );

  app.get(
    '/:slug/todos',
    { schema: { params: slugParam } },
    async (req) => {
      const svc = makeDashboard({ db: app.deps.db, liveTracker: app.deps.liveTracker });
      return svc.todosBySlug((req.params as { slug: string }).slug);
    },
  );

  app.get(
    '/:slug/notes',
    { schema: { params: slugParam } },
    async (req) => {
      const svc = makeDashboard({ db: app.deps.db, liveTracker: app.deps.liveTracker });
      return svc.notesBySlug((req.params as { slug: string }).slug);
    },
  );
}
