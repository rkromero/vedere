// Emisión y rotación de sesiones: access token (JWT, cookie httpOnly) + refresh token (opaco, hasheado en DB).
import { createHmac, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CookieSerializeOptions } from '@fastify/cookie';
import { prisma } from '@vedere/db';
import type { Rol } from '@vedere/db';
import type { Env } from '../env.js';
import { ttlToSeconds } from '../env.js';

export const ACCESS_COOKIE = 'vedere_access';
export const REFRESH_COOKIE = 'vedere_refresh';
/** El refresh token sólo viaja a /auth/* (refresh y logout). */
export const REFRESH_COOKIE_PATH = '/auth';

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  /** Sólo rol OPTICA: óptica socia a la que pertenece. */
  opticaId?: string | null;
  /** B2B: dueño de la óptica y contraseña provisoria pendiente de cambio. */
  opticaDueno?: boolean;
  debeCambiarPassword?: boolean;
  createdAt: Date;
}

export interface AccessPayload {
  sub: string;
  email: string;
  rol: Rol;
  nombre?: string;
  opticaId?: string | null;
}

export function toPublicUser(user: SessionUser & { optica?: { id: string; nombre: string; slug: string } | null }) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    telefono: user.telefono,
    rol: user.rol,
    activo: user.activo,
    opticaId: user.opticaId ?? null,
    optica: user.optica ? { id: user.optica.id, nombre: user.optica.nombre, slug: user.optica.slug } : null,
    opticaDueno: user.opticaDueno ?? false,
    debeCambiarPassword: user.debeCambiarPassword ?? false,
    createdAt: user.createdAt,
  };
}

export function cookieOptions(
  env: Env,
  opts: { path: string; maxAge: number },
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: opts.path,
    maxAge: opts.maxAge,
  };
}

export function hashRefreshToken(env: Env, token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

function requestMeta(request: FastifyRequest) {
  return {
    userAgent: request.headers['user-agent']?.slice(0, 255) ?? null,
    ip: request.ip ?? null,
  };
}

/** Crea access + refresh y los setea como cookies httpOnly. */
export async function issueSession(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  user: SessionUser,
): Promise<void> {
  const env = app.env;
  const payload: AccessPayload = {
    sub: user.id,
    email: user.email,
    rol: user.rol,
    nombre: user.nombre,
    opticaId: user.opticaId ?? null,
  };
  const accessToken = app.jwt.sign(payload, { expiresIn: env.ACCESS_TOKEN_TTL });

  const refreshToken = randomBytes(48).toString('base64url');
  const refreshMaxAge = env.REFRESH_TOKEN_TTL_DAYS * 86400;
  const expiresAt = new Date(Date.now() + refreshMaxAge * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(env, refreshToken),
      userId: user.id,
      expiresAt,
      ...requestMeta(request),
    },
  });

  reply.setCookie(
    ACCESS_COOKIE,
    accessToken,
    cookieOptions(env, { path: '/', maxAge: ttlToSeconds(env.ACCESS_TOKEN_TTL) }),
  );
  reply.setCookie(
    REFRESH_COOKIE,
    refreshToken,
    cookieOptions(env, { path: REFRESH_COOKIE_PATH, maxAge: refreshMaxAge }),
  );
}

export function clearSessionCookies(app: FastifyInstance, reply: FastifyReply): void {
  const env = app.env;
  reply.clearCookie(ACCESS_COOKIE, cookieOptions(env, { path: '/', maxAge: 0 }));
  reply.clearCookie(REFRESH_COOKIE, cookieOptions(env, { path: REFRESH_COOKIE_PATH, maxAge: 0 }));
}

/** Revoca un refresh token (idempotente). */
export async function revokeRefreshToken(env: Env, token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(env, token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
