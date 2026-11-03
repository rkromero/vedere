// ABM de usuarios: sólo ADMIN (el guard lo pone routes/admin/index.ts).
import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { toPublicUser } from '../../lib/tokens.js';
import { parse } from '../../lib/validate.js';
import {
  usuarioInput,
  usuarioListQuery,
  usuarioPassword,
  usuarioUpdate,
} from '../../schemas/catalogo.js';

const listQuery = paginationQuery.extend(usuarioListQuery.shape);

const usuariosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where: Prisma.UserWhereInput = {
      ...(q.q
        ? {
            OR: [
              { nombre: { contains: q.q, mode: 'insensitive' } },
              { email: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.rol ? { rol: q.rol } : {}),
      ...(q.activo ? { activo: q.activo === 'true' } : {}),
    };
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
    ]);
    return pageResponse(users.map(toPublicUser), total, q);
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!user) throw Errors.notFound('Usuario no encontrado');
    return toPublicUser(user);
  });

  app.post('/', async (request, reply) => {
    const body = parse(usuarioInput, request.body);
    const { password, ...data } = body;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await prisma.user.create({ data: { ...data, passwordHash } });
    return reply.status(201).send(toPublicUser(user));
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(usuarioUpdate, request.body);
    const existing = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Usuario no encontrado');

    const esMismo = existing.id === request.user.sub;
    if (esMismo && body.rol && body.rol !== 'ADMIN') {
      throw Errors.badRequest('No podés quitarte el rol ADMIN a vos mismo');
    }
    if (esMismo && body.activo === false) {
      throw Errors.badRequest('No podés desactivar tu propio usuario');
    }

    const user = await prisma.user.update({ where: { id: existing.id }, data: body });

    // Si pierde acceso (desactivado o cambia de rol), se cierran sus sesiones.
    if (body.activo === false || (body.rol && body.rol !== existing.rol)) {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return toPublicUser(user);
  });

  /** Resetea la contraseña (la define el admin) y cierra todas las sesiones del usuario. */
  app.post<{ Params: { id: string } }>('/:id/password', async (request) => {
    const body = parse(usuarioPassword, request.body);
    const existing = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Usuario no encontrado');
    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
    await prisma.refreshToken.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  });

  /** Desactivar (baja lógica). */
  app.post<{ Params: { id: string } }>('/:id/desactivar', async (request) => {
    const existing = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Usuario no encontrado');
    if (existing.id === request.user.sub)
      throw Errors.badRequest('No podés desactivar tu propio usuario');
    const user = await prisma.user.update({ where: { id: existing.id }, data: { activo: false } });
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return toPublicUser(user);
  });

  app.post<{ Params: { id: string } }>('/:id/activar', async (request) => {
    const existing = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Usuario no encontrado');
    const user = await prisma.user.update({ where: { id: existing.id }, data: { activo: true } });
    return toPublicUser(user);
  });
};

export default usuariosRoutes;
