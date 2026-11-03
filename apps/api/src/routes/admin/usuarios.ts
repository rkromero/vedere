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
const opticaSelect = { optica: { select: { id: true, nombre: true, slug: true } } } as const;

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
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q), include: opticaSelect }),
    ]);
    return pageResponse(users.map(toPublicUser), total, q);
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.params.id }, include: opticaSelect });
    if (!user) throw Errors.notFound('Usuario no encontrado');
    return toPublicUser(user);
  });

  /** Rol OPTICA exige una óptica existente; otros roles no llevan óptica. */
  async function validarOptica(rol: string | undefined, opticaId: string | null | undefined) {
    if (rol === 'OPTICA') {
      if (!opticaId) {
        throw Errors.badRequest('Un usuario OPTICA debe estar vinculado a una óptica', [
          { path: 'opticaId', message: 'Elegí la óptica' },
        ]);
      }
      const o = await prisma.optica.findUnique({ where: { id: opticaId }, select: { id: true } });
      if (!o) throw Errors.badRequest('Óptica inexistente', [{ path: 'opticaId', message: 'Elegí una óptica válida' }]);
      return opticaId;
    }
    return null;
  }

  app.post('/', async (request, reply) => {
    const body = parse(usuarioInput, request.body);
    const { password, ...data } = body;
    const opticaId = await validarOptica(data.rol, data.opticaId);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await prisma.user.create({ data: { ...data, opticaId, passwordHash }, include: opticaSelect });
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

    const rolFinal = body.rol ?? existing.rol;
    const opticaId =
      body.rol !== undefined || body.opticaId !== undefined
        ? await validarOptica(rolFinal, body.opticaId === undefined ? existing.opticaId : body.opticaId)
        : undefined;
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { ...body, ...(opticaId !== undefined ? { opticaId } : {}) },
      include: opticaSelect,
    });

    // Si pierde acceso (desactivado, cambia de rol o de óptica), se cierran sus sesiones.
    if (body.activo === false || (body.rol && body.rol !== existing.rol) || (opticaId !== undefined && opticaId !== existing.opticaId)) {
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
