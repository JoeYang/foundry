import type { FastifyInstance } from 'fastify';
import { listRoute } from './list.js';
import { detailRoute } from './detail.js';
import { timelineRoute } from './timeline.js';
import { aspectsRoutes } from './aspects.js';
import { flagsRoute } from './flags.js';
import { deleteRoute } from './delete.js';

export async function dashboardRoutes(app: FastifyInstance) {
  await app.register(
    async (scope) => {
      await scope.register(listRoute);
      await scope.register(detailRoute);
      await scope.register(timelineRoute);
      await scope.register(aspectsRoutes);
      await scope.register(flagsRoute);
      await scope.register(deleteRoute);
    },
    { prefix: '/projects' },
  );
}
