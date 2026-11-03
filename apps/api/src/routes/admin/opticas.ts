// ABM de ópticas socias (staff).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { uniqueSlug } from '../../lib/slug.js';
import { parse } from '../../lib/validate.js';
import { opticaInput, opticaUpdate } from '../../schemas/tienda.js';

const listQuery = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  activa: z.enum(['true', 'false']).optional(),
  provincia: z.string().trim().max(80).optional(),
});

const opticasRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where: Prisma.OpticaWhereInput = {
      ...(q.activa ? { activa: q.activa === 'true' } : {}),
      ...(q.provincia ? { provincia: { equals: q.provincia, mode: 'insensitive' } } : {}),
    };
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      where.OR = [
        { nombre: contains },
        { localidad: contains },
        { direccion: contains },
        { codigoPostal: contains },
      ];
    }
    const [total, items] = await Promise.all([
      prisma.optica.count({ where }),
      prisma.optica.findMany({
        where,
        orderBy: [{ orden: 'asc' }, { provincia: 'asc' }, { localidad: 'asc' }, { nombre: 'asc' }],
        ...paginate(q),
      }),
    ]);
    return pageResponse(items, total, q);
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const o = await prisma.optica.findUnique({ where: { id: request.params.id } });
    if (!o) throw Errors.notFound('Óptica no encontrada');
    return o;
  });

  app.post('/', async (request, reply) => {
    const body = parse(opticaInput, request.body);
    const slug = await uniqueSlug(
      body.slug ?? body.nombre + ' ' + body.localidad,
      async (s) => !!(await prisma.optica.findUnique({ where: { slug: s }, select: { id: true } })),
    );
    const o = await prisma.optica.create({
      data: {
        ...body,
        slug,
        email: body.email || null,
        createdById: request.user.sub,
        updatedById: request.user.sub,
      },
    });
    return reply.status(201).send(o);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(opticaUpdate, request.body);
    const existing = await prisma.optica.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Óptica no encontrada');
    if (body.slug && body.slug !== existing.slug) {
      const taken = await prisma.optica.findUnique({
        where: { slug: body.slug },
        select: { id: true },
      });
      if (taken) throw Errors.conflict('Ya existe otra óptica con ese slug');
    }
    return prisma.optica.update({
      where: { id: existing.id },
      data: {
        ...body,
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        updatedById: request.user.sub,
      },
    });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.optica.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Óptica no encontrada');
    await prisma.optica.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default opticasRoutes;
