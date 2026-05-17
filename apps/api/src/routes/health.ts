import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/livez', async () => {
    try {
      await app.deps.db.pool.query('SELECT 1');
      return { status: 'ok' };
    } catch (err) {
      app.log.error({ err }, 'livez failed');
      return { status: 'degraded', reason: 'db unreachable' };
    }
  });
}
