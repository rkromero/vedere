import type { FastifyPluginAsync } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { User } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  cookieOptions,
  hashRefreshToken,
  issueSession,
  revokeRefreshToken,
  toPublicUser,
} from '../lib/tokens.js';
import { enviarPlantilla } from '../lib/plantillas.js';
import { usuarioPorCodigoReferido } from '../lib/referidos.js';
import {
  GOOGLE_STATE_COOKIE,
  crearState,
  googleHabilitado,
  leerState,
  perfilDesdeCodigo,
  urlAutorizacion,
} from '../lib/google-oauth.js';
import {
  codigoReferidoInput,
  googleCallbackQuery,
  googleStartQuery,
  recuperarInput,
  restablecerInput,
} from '../schemas/cuenta.js';

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
  /// Prompt 6: código de referido (cookie vedere_ref del link /r/<codigo>).
  ref: codigoReferidoInput.nullable().optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresá tu contraseña').max(128),
});

// Hash "dummy" para igualar el tiempo de respuesta cuando el email no existe (evita enumeración).
const DUMMY_HASH_PROMISE = argon2.hash('vedere-dummy-password', { type: argon2.argon2id });

/** Hash reservado para cuentas creadas con Google que todavía no eligieron contraseña. */
const SIN_PASSWORD = '!google';
const RESET_TTL_MIN = 60;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const authRoutes: FastifyPluginAsync = async (app) => {
  const authLimit = {
    rateLimit: { max: app.env.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' },
  };
  const web = app.env.WEB_URL.replace(/\/$/, '');

  /** Email de bienvenida (plantilla BIENVENIDA). Nunca lanza. */
  async function bienvenida(user: Pick<User, 'email' | 'nombre'>) {
    await enviarPlantilla(app.env, {
      tipo: 'BIENVENIDA',
      para: user.email,
      vars: { nombre: user.nombre.split(' ')[0] || user.nombre, url: `${web}/mi-cuenta`, urlReferidos: `${web}/mi-cuenta/referidos` },
      ctaHref: `${web}/mi-cuenta`,
    });
  }

  app.post('/register', { config: authLimit }, async (request, reply) => {
    const body = parse(registerSchema, request.body);

    const exists = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (exists) {
      throw Errors.conflict('Ya existe una cuenta con ese email');
    }

    const referente = body.ref ? await usuarioPorCodigoReferido(body.ref) : null;
    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: {
        email: body.email,
        nombre: body.nombre,
        telefono: body.telefono ?? null,
        passwordHash,
        rol: 'CLIENTE',
        referidoPorId: referente?.id ?? null,
      },
    });

    await issueSession(app, request, reply, user);
    await bienvenida(user);
    return reply.status(201).send({ user: toPublicUser(user), referido: !!referente });
  });

  app.post('/login', { config: authLimit }, async (request, reply) => {
    const body = parse(loginSchema, request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { optica: { select: { id: true, nombre: true, slug: true } } },
    });
    // Cuentas creadas con Google sin contraseña: no pueden entrar por acá (hash reservado que empieza con "!").
    const tienePassword = !!user && !user.passwordHash.startsWith('!');
    const hash = tienePassword ? user!.passwordHash : await DUMMY_HASH_PROMISE;
    const valid = (await argon2.verify(hash, body.password)) && tienePassword;

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

  // ---------- Recuperación de contraseña (prompt 6) ----------

  /** Siempre 204 (no revela si el email existe). Si existe, manda el link con un token de un solo uso. */
  app.post('/recuperar', { config: authLimit }, async (request, reply) => {
    const body = parse(recuperarInput, request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user && user.activo) {
      const token = randomBytes(32).toString('base64url');
      await prisma.$transaction([
        // Un solo link vigente por usuario.
        prisma.passwordReset.updateMany({ where: { userId: user.id, usadoEn: null }, data: { usadoEn: new Date() } }),
        prisma.passwordReset.create({
          data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) },
        }),
      ]);
      const url = `${web}/restablecer/${token}`;
      await enviarPlantilla(app.env, {
        tipo: 'RECUPERAR_PASSWORD',
        para: user.email,
        vars: { nombre: user.nombre.split(' ')[0] || user.nombre, url },
        ctaHref: url,
      });
    }
    return reply.status(204).send();
  });

  app.post('/restablecer', { config: authLimit }, async (request, reply) => {
    const body = parse(restablecerInput, request.body);
    const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(body.token) }, include: { user: true } });
    if (!reset || reset.usadoEn || reset.expiresAt.getTime() < Date.now() || !reset.user.activo) {
      throw Errors.badRequest('El link ya no es válido. Pedí uno nuevo.', [{ path: 'token', message: 'Link vencido o ya usado' }]);
    }
    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    await prisma.$transaction([
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usadoEn: new Date() } }),
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      // Cierra las sesiones abiertas: quien tenga la cuenta deja de poder renovarla.
      prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return reply.status(204).send();
  });

  // ---------- Login con Google (prompt 6) ----------

  app.get('/google', { config: authLimit }, async (request, reply) => {
    if (!googleHabilitado(app.env)) throw Errors.notFound('El login con Google no está habilitado');
    const q = parse(googleStartQuery, request.query);
    const state = crearState(app.env, { next: q.next, ref: q.ref });
    reply.setCookie(GOOGLE_STATE_COOKIE, state, cookieOptions(app.env, { path: '/', maxAge: 600 }));
    return reply.redirect(urlAutorizacion(app.env, state), 302);
  });

  app.get('/google/callback', { config: authLimit }, async (request, reply) => {
    const error = (motivo: string) => {
      reply.clearCookie(GOOGLE_STATE_COOKIE, cookieOptions(app.env, { path: '/', maxAge: 0 }));
      return reply.redirect(`${web}/ingresar?error=google&motivo=${encodeURIComponent(motivo)}`, 302);
    };
    if (!googleHabilitado(app.env)) return error('deshabilitado');
    const q = parse(googleCallbackQuery, request.query);
    if (q.error || !q.code || !q.state) return error(q.error ?? 'cancelado');
    const esperado = request.cookies[GOOGLE_STATE_COOKIE];
    if (!esperado || esperado !== q.state) return error('estado');
    const state = leerState(app.env, q.state);
    if (!state) return error('estado');

    let perfil;
    try {
      perfil = await perfilDesdeCodigo(app.env, q.code);
    } catch (err) {
      request.log.warn({ err }, 'google oauth: no se pudo obtener el perfil');
      return error('google');
    }
    if (!perfil.emailVerificado) return error('email-no-verificado');

    let user = await prisma.user.findUnique({ where: { googleId: perfil.sub } });
    let nuevo = false;
    if (!user) {
      const porEmail = await prisma.user.findUnique({ where: { email: perfil.email } });
      if (porEmail) {
        // Cuenta existente (email y contraseña): se vincula a Google.
        user = await prisma.user.update({ where: { id: porEmail.id }, data: { googleId: perfil.sub } });
      } else {
        const referente = state.ref ? await usuarioPorCodigoReferido(state.ref) : null;
        user = await prisma.user.create({
          data: {
            email: perfil.email,
            nombre: perfil.nombre ?? perfil.email.split('@')[0]!,
            passwordHash: SIN_PASSWORD,
            rol: 'CLIENTE',
            googleId: perfil.sub,
            referidoPorId: referente?.id ?? null,
          },
        });
        nuevo = true;
      }
    }
    if (!user.activo) return error('inactivo');

    reply.clearCookie(GOOGLE_STATE_COOKIE, cookieOptions(app.env, { path: '/', maxAge: 0 }));
    await issueSession(app, request, reply, user);
    if (nuevo) await bienvenida(user);
    const destino = state.next.startsWith('/') && !state.next.startsWith('//') ? state.next : '/mi-cuenta';
    return reply.redirect(`${web}${destino}${nuevo ? (destino.includes('?') ? '&' : '?') + 'bienvenida=1' : ''}`, 302);
  });
};

export default authRoutes;
