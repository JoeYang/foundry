import { buildServer } from '../../src/server.js';
import type { Config } from '../../src/config.js';
import type { DbClient } from '@foundry/db';
import { schema } from '@foundry/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createTestSchema } from '../../../../packages/db/tests/helpers.js';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';

export interface TestStack {
  app: FastifyInstance;
  schemaName: string;
  cleanup: () => Promise<void>;
}

const APP_URL =
  process.env.DB_URL_APP ?? 'postgres://foundry_app:foundry_app@localhost:5433/foundry';

export async function startTestServer(overrides: Partial<Config> = {}): Promise<TestStack> {
  const ctx = await createTestSchema();

  // Create an app-role pool whose connections all SET search_path to the test schema
  const appPool = new pg.Pool({ connectionString: APP_URL });
  appPool.on('connect', (c) => {
    c.query(`SET search_path TO "${ctx.schemaName}", public`);
  });
  const db: DbClient = {
    db: drizzle(appPool, { schema }),
    pool: appPool,
    close: async () => {
      await appPool.end();
    },
  };

  const config: Config = {
    port: 0,
    host: '127.0.0.1',
    dbUrlApp: APP_URL,
    heartbeatTtlSec: 1800,
    logLevel: 'fatal',
    ...overrides,
  };

  const app = await buildServer(config, db);

  return {
    app,
    schemaName: ctx.schemaName,
    cleanup: async () => {
      await app.close();
      await ctx.close();
    },
  };
}
