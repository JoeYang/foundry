import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(5380),
  host: z.string().default('127.0.0.1'),
  dbUrlApp: z.string().min(1),
  heartbeatTtlSec: z.coerce.number().int().positive().default(1800),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse({
    port: env.PORT,
    host: env.HOST,
    dbUrlApp: env.DB_URL_APP,
    heartbeatTtlSec: env.FOUNDRY_HEARTBEAT_TTL_SEC,
    logLevel: env.LOG_LEVEL,
  });
}
