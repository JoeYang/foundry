import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { projectStatusSchema } from '@foundry/shared';
import { makeDashboard } from '../../services/dashboard.js';

const listQuery = z.object({
  status: projectStatusSchema.optional(),
  search: z.string().optional(),
  sort: z.enum(['recently_updated', 'name_asc', 'last_heartbeat_desc']).optional(),
  include_archived: z.coerce.boolean().optional(),
});

export async function listRoute(app: FastifyInstance) {
  app.get(
    '/',
    {
      schema: { querystring: listQuery },
    },
    async (req) => {
      const query = listQuery.parse((req as { query: unknown }).query);
      const svc = makeDashboard({ db: app.deps.db, liveTracker: app.deps.liveTracker });
      const opts: import('../../services/dashboard.js').ListOpts = {};
      if (query.status !== undefined) opts.status = query.status;
      if (query.search !== undefined) opts.search = query.search;
      if (query.sort !== undefined) opts.sort = query.sort;
      if (query.include_archived !== undefined) opts.includeArchived = query.include_archived;
      return svc.list(opts);
    },
  );
}
