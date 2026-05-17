import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export interface DbClient {
  db: NodePgDatabase<typeof schema>;
  pool: pg.Pool;
  close: () => Promise<void>;
}

export function createDbClient(url?: string): DbClient {
  const connectionString = url ?? process.env.DB_URL_APP;
  if (!connectionString) {
    throw new Error('DB_URL_APP env var must be set or url passed to createDbClient()');
  }
  const pool = new pg.Pool({
    connectionString,
    statement_timeout: 10_000, // 10s — catches runaway queries
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}
