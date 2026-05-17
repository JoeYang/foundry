import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { makeFlags } from '../../services/flags.js';

const slugParam = z.object({ slug: z.string().min(1) });

export const deleteRoute: FastifyPluginAsyncZod = async function deleteRoute(app) {
  app.delete(
    '/:slug',
    {
      schema: { params: slugParam },
    },
    async (req, reply) => {
      const svc = makeFlags({ db: app.deps.db });
      await svc.delete(req.params.slug);
      return reply.status(204).send();
    },
  );
};
