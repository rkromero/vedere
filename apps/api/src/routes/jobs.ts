// Disparo manual de jobs (prompt 6): POST /jobs/:nombre con header x-cron-secret (CRON_SECRET), p. ej. desde
// GitHub Actions o un cron externo. Sin CRON_SECRET configurado, las rutas responden 403.
import type { FastifyPluginAsync } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { AppError, Errors } from '../lib/errors.js';
import { JOBS, NOMBRES_JOBS, ejecutarJob } from '../jobs/index.js';

const jobsRateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

function secretoValido(esperado: string | undefined, recibido: unknown): boolean {
  if (!esperado || typeof recibido !== 'string') return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recibido);
  return a.length === b.length && timingSafeEqual(a, b);
}

const jobsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request) => {
    if (!secretoValido(app.env.CRON_SECRET, request.headers['x-cron-secret'])) {
      throw Errors.forbidden('Falta o no coincide x-cron-secret');
    }
  });

  app.get('/', jobsRateLimit, async () => ({ items: NOMBRES_JOBS }));

  app.post<{ Params: { nombre: string } }>('/:nombre', jobsRateLimit, async (request) => {
    const { nombre } = request.params;
    if (!JOBS[nombre]) throw new AppError(404, 'NOT_FOUND', `Job desconocido: ${nombre}`);
    const inicio = Date.now();
    const enviados = await ejecutarJob(nombre, app.env);
    return { job: nombre, enviados, ms: Date.now() - inicio };
  });
};

export default jobsRoutes;
