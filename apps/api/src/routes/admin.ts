// Rutas de administración: sólo ADMIN. Cualquier otro rol recibe 403, sin sesión 401.
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import { parse } from '../lib/validate.js';
import { toPublicUser } from '../lib/tokens.js';

const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  rol: z.enum(['ADMIN', 'OPERADOR', 'OPTICA', 'CLIENTE']).optional(),
});

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.requireRole('ADMIN'));

  app.get('/ping', async (request) => ({
    ok: true,
    rol: request.user.rol,
    userId: request.user.sub,
  }));

  app.get('/users', async (request) => {
    const q = parse(listUsersQuery, request.query);
    const where = q.rol ? { rol: q.rol } : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      items: users.map(toPublicUser),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  });
};

export default adminRoutes;
