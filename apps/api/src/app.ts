import Fastify from 'fastify';
import type { FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { Env } from './env.js';
import { loadEnv } from './env.js';
import authPlugin from './plugins/auth.js';
import { errorHandler } from './lib/errors.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/uploads.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
  }
}

export interface BuildAppOptions {
  env?: Env;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const env = opts.env ?? loadEnv();

  const app = Fastify({
    logger: opts.logger ?? defaultLogger(env),
    // Railway / proxies: tomar la IP real del cliente para rate limiting.
    trustProxy: true,
  });

  app.decorate('env', env);

  await app.register(helmet, { global: true });

  // CORS: únicamente el dominio de la web, con credenciales (cookies).
  await app.register(cors, {
    origin: [env.WEB_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    allowList: (request) => request.url === '/health',
  });

  await app.register(authPlugin);

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler({ preHandler: app.rateLimit() }, (request, reply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Ruta ${request.method} ${request.url} no encontrada` },
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(uploadRoutes, { prefix: '/uploads' });

  return app;
}

function defaultLogger(env: Env): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'test') return false;
  if (env.NODE_ENV === 'development') {
    return {
      level: 'debug',
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
    };
  }
  return { level: 'info' };
}
