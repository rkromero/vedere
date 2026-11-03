// Plugin de autenticación: JWT en cookie httpOnly + guards de roles.
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@vedere/db';
import type { Optica, Rol } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { ACCESS_COOKIE } from '../lib/tokens.js';
import type { AccessPayload } from '../lib/tokens.js';

export type RouteGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessPayload;
    user: AccessPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Exige access token válido (cookie o header Authorization: Bearer). */
    authenticate: RouteGuard;
    /** Exige access token válido y que el rol esté en la lista. */
    requireRole: (...roles: Rol[]) => RouteGuard;
    /** Carga request.user si hay token válido; si no, sigue como anónimo (request.user queda undefined). */
    optionalAuthenticate: RouteGuard;
    /**
     * Exige rol OPTICA con una óptica vinculada y activa (se verifica en la base en cada request, así un
     * cambio de óptica o una baja aplican al instante). Deja request.optica con la óptica.
     */
    requireOptica: RouteGuard;
  }
  interface FastifyRequest {
    optica?: Optica;
  }
}

export default fp(
  async (app) => {
    await app.register(jwt, {
      secret: app.env.JWT_ACCESS_SECRET,
      cookie: { cookieName: ACCESS_COOKIE, signed: false },
      sign: { expiresIn: app.env.ACCESS_TOKEN_TTL },
    });

    const authenticate: RouteGuard = async (request) => {
      try {
        await request.jwtVerify();
      } catch {
        throw Errors.unauthorized();
      }
    };

    app.decorate('authenticate', authenticate);
    app.decorate('optionalAuthenticate', async (request: FastifyRequest) => {
      try {
        await request.jwtVerify();
      } catch {
        /* anónimo */
      }
    });
    app.decorate('requireRole', (...roles: Rol[]): RouteGuard => {
      return async (request, reply) => {
        await authenticate(request, reply);
        if (!roles.includes(request.user.rol)) {
          throw Errors.forbidden();
        }
      };
    });
    app.decorate('requireOptica', async (request: FastifyRequest, reply: FastifyReply) => {
      await authenticate(request, reply);
      if (request.user.rol !== 'OPTICA') throw Errors.forbidden();
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { activo: true, opticaId: true, optica: true },
      });
      if (!user || !user.activo) throw Errors.unauthorized();
      if (!user.optica) throw Errors.forbidden('Tu usuario no está vinculado a ninguna óptica');
      request.optica = user.optica;
    });
  },
  { name: 'vedere-auth', dependencies: ['@fastify/cookie'] },
);
