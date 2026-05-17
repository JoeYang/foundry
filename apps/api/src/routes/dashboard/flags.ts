import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { patchFlagsInputSchema } from '@foundry/shared';
import { makeFlags } from '../../services/flags.js';

const slugParam = z.object({ slug: z.string().min(1) });

export const flagsRoute: FastifyPluginAsyncZod = async function flagsRoute(app) {
  app.patch(
    '/:slug/flags',
    {
      schema: { body: patchFlagsInputSchema, params: slugParam },
    },
    async (req) => {
      const svc = makeFlags({ db: app.deps.db });
      return svc.patch(req.params.slug, req.body);
    },
  );
};
