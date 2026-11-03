import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  hashRefreshToken,
  issueSession,
  revokeRefreshToken,
  toPublicUser,
} from '../lib/tokens.js';

const emailSchema = z.email({ error: 'Email inválido' }).transform((v) => v.trim().toLowerCase());
const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

const registerSchema = z.object({
  email: emailSchema,
  nombre: z.string().trim().min(2, 'Ingresá tu nombre').max(120),
  telefono: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s()-]{5,24}$/, 'Teléfono inválido')
    .optional(),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresá tu contraseña').max(128),
});

// Hash "dummy" para igualar el tiempo de respuesta cuando el email no existe (evita enumeración).
const DUMMY_HASH_PROMISE = argon2.hash('vedere-dummy-password', { type: argon2.argon2id });

const authRoutes: FastifyPluginAsync = async (app) => {
  const authLimit = {
    rateLimit: { max: app.env.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' },
  };

  app.post('/register', { config: authLimit }, async (request, reply) => {
    const body = parse(registerSchema, request.body);

    const exists = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (exists) {
      throw Errors.conflict('Ya existe una cuenta con ese email');
    }

    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: {
        email: body.email,
        nombre: body.nombre,
        telefono: body.telefono ?? null,
        passwordHash,
        rol: 'CLIENTE',
      },
    });

    await issueSession(app, request, reply, user);
    return reply.status(201).send({ user: toPublicUser(user) });
  });

  app.post('/login', { config: authLimit }, async (request, reply) => {
    const body = parse(loginSchema, request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { optica: { select: { id: true, nombre: true, slug: true } } },
    });
    const hash = user?.passwordHash ?? (await DUMMY_HASH_PROMISE);
    const valid = await argon2.verify(hash, body.password);

    if (!user || !valid || !user.activo) {
      throw Errors.unauthorized('Email o contraseña incorrectos');
    }

    await issueSession(app, request, reply, user);
    return reply.send({ user: toPublicUser(user) });
  });

  app.post('/refresh', { config: authLimit }, async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (!token) {
      throw Errors.unauthorized('Sesión expirada');
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(app.env, token) },
      include: { user: true },
    });

    const invalid =
      !stored ||
      stored.revokedAt !== null ||
      stored.expiresAt.getTime() < Date.now() ||
      !stored.user.activo;

    if (invalid) {
      clearSessionCookies(app, reply);
      throw Errors.unauthorized('Sesión expirada');
    }

    // Rotación: el token usado se revoca y se emite uno nuevo.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    await issueSession(app, request, reply, stored.user);
    return reply.send({ user: toPublicUser(stored.user) });
  });

  app.post('/logout', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (token) {
      await revokeRefreshToken(app.env, token);
    }
    clearSessionCookies(app, reply);
    return reply.status(204).send();
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      include: { optica: { select: { id: true, nombre: true, slug: true } } },
    });
    if (!user || !user.activo) {
      clearSessionCookies(app, reply);
      throw Errors.unauthorized();
    }
    return reply.send({ user: toPublicUser(user) });
  });
};

export default authRoutes;
