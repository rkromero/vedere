import type { FastifyPluginAsync } from 'fastify';
import { checkDatabase } from '@vedere/db';

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    const db = await checkDatabase();
    const body = {
      status: db.ok ? 'ok' : 'degraded',
      service: 'vedere-api',
      version: app.env.APP_VERSION,
      env: app.env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      db: { ok: db.ok, latencyMs: db.latencyMs, ...(db.error ? { error: db.error } : {}) },
    };
    return reply.status(db.ok ? 200 : 503).send(body);
  });
};

export default healthRoutes;
