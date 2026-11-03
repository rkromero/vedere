// Diagnóstico (prompt 6): estado de Sentry y error forzado para verificar que llega al proyecto. Sólo ADMIN.
import type { FastifyPluginAsync } from 'fastify';
import { sentryHabilitado } from '../../lib/sentry.js';

const debugRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.requireRole('ADMIN'));

  app.get('/sentry', async () => ({
    habilitado: sentryHabilitado(),
    environment: app.env.SENTRY_ENVIRONMENT ?? app.env.NODE_ENV,
  }));

  /** Lanza un error 500 a propósito: debe aparecer en Sentry (si hay DSN) y en los logs. */
  app.get('/error', async (request) => {
    throw new Error(`Error de prueba para Sentry (${request.user.email}, ${new Date().toISOString()})`);
  });
};

export default debugRoutes;
