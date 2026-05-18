import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createDbClient, type DbClient } from '@foundry/db';
import { LiveTracker } from './services/live-tracker.js';
import { type Config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agent/index.js';
import { dashboardRoutes } from './routes/dashboard/index.js';
import { requestIdPlugin } from './middleware/request-id.js';
import { errorHandlerPlugin } from './middleware/error-handler.js';
import { mcpPlugin, mcpProtocolPlugin } from '@foundry/mcp';

export interface ServerDeps {
  config: Config;
  db: DbClient;
  liveTracker: LiveTracker;
}

export async function buildServer(config: Config, dbOverride?: DbClient): Promise<FastifyInstance> {
  const db = dbOverride ?? createDbClient(config.dbUrlApp);
  const liveTracker = new LiveTracker(config.heartbeatTtlSec * 1000);

  const app = Fastify({
    logger: { level: config.logLevel },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(requestIdPlugin);
  await app.register(errorHandlerPlugin);

  app.decorate('deps', { config, db, liveTracker } as ServerDeps);

  app.register(healthRoutes, { prefix: '/v1' });
  await app.register(agentRoutes, { prefix: '/v1/agent' });
  await app.register(dashboardRoutes, { prefix: '/v1' });
  await app.register(mcpProtocolPlugin, { prefix: '/mcp' });
  await app.register(mcpPlugin, { prefix: '/mcp' });

  app.addHook('onClose', async () => {
    await db.close();
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: ServerDeps;
  }
}
