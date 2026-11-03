import path from 'node:path';
import Fastify from 'fastify';
import type { FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { Env } from './env.js';
import { loadEnv } from './env.js';
import { iniciarSentry } from './lib/sentry.js';
import authPlugin from './plugins/auth.js';
import { errorHandler } from './lib/errors.js';
import { storageDriver } from './lib/storage.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin/index.js';
import debugRoutes from './routes/admin/debug.js';
import catalogoRoutes from './routes/catalogo.js';
import carritoRoutes from './routes/carrito.js';
import checkoutRoutes from './routes/checkout.js';
import opticaRoutes from './routes/optica.js';
import cuentaRoutes from './routes/cuenta.js';
import sitioRoutes from './routes/sitio.js';
import feedsRoutes from './routes/feeds.js';
import jobsRoutes from './routes/jobs.js';

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
  iniciarSentry(env);

  const app = Fastify({
    logger: opts.logger ?? defaultLogger(env),
    // Railway / proxies: tomar la IP real del cliente para rate limiting.
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  app.decorate('env', env);

  await app.register(helmet, {
    global: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // imágenes servidas en modo local
  });

  // CORS: únicamente el dominio de la web, con credenciales (cookies).
  await app.register(cors, {
    origin: [env.WEB_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    allowList: (request) => request.url === '/health',
  });

  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  });

  // text/csv como string (importación de productos).
  app.addContentTypeParser('text/csv', { parseAs: 'string' }, (_req, body, done) =>
    done(null, body),
  );

  // Imágenes en modo local (desarrollo): /uploads/*
  if (storageDriver(env) === 'local') {
    await app.register(fastifyStatic, {
      root: path.resolve(env.UPLOADS_DIR),
      prefix: '/uploads/',
      decorateReply: false,
      cacheControl: true,
      maxAge: '7d',
    });
  }

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
  await app.register(debugRoutes, { prefix: '/admin/debug' });
  await app.register(catalogoRoutes, { prefix: '/catalogo' });
  await app.register(carritoRoutes, { prefix: '/carrito' });
  await app.register(checkoutRoutes, { prefix: '/checkout' });
  await app.register(opticaRoutes, { prefix: '/optica' });
  await app.register(cuentaRoutes, { prefix: '/cuenta' });
  await app.register(sitioRoutes, { prefix: '/sitio' });
  await app.register(feedsRoutes, { prefix: '/feeds' });
  await app.register(jobsRoutes, { prefix: '/jobs' });

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
