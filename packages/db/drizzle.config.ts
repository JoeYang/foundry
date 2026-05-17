import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DB_URL_MIGRATE ?? 'postgres://foundry:foundry@localhost:5433/foundry',
  },
} satisfies Config;
