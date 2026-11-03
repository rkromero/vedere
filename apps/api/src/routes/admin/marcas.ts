import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { uniqueSlug } from '../../lib/slug.js';
import { parse } from '../../lib/validate.js';
import { marcaInput, marcaUpdate } from '../../schemas/catalogo.js';

const listQuery = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  activa: z.enum(['true', 'false']).optional(),
});

const marcasRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where = {
      ...(q.q ? { nombre: { contains: q.q, mode: 'insensitive' as const } } : {}),
      ...(q.activa ? { activa: q.activa === 'true' } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.marca.count({ where }),
      prisma.marca.findMany({
        where,
        orderBy: { nombre: 'asc' },
        include: { _count: { select: { productos: true } } },
        ...paginate(q),
      }),
    ]);
    return pageResponse(
      items.map(({ _count, ...m }) => ({ ...m, productos: _count.productos })),
      total,
      q,
    );
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const marca = await prisma.marca.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { productos: true } } },
    });
    if (!marca) throw Errors.notFound('Marca no encontrada');
    const { _count, ...m } = marca;
    return { ...m, productos: _count.productos };
  });

  app.post('/', async (request, reply) => {
    const body = parse(marcaInput, request.body);
    const slug = await uniqueSlug(
      body.slug ?? body.nombre,
      async (s) => !!(await prisma.marca.findUnique({ where: { slug: s }, select: { id: true } })),
    );
    const marca = await prisma.marca.create({
      data: { ...body, slug, createdById: request.user.sub, updatedById: request.user.sub },
    });
    return reply.status(201).send(marca);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(marcaUpdate, request.body);
    const existing = await prisma.marca.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Marca no encontrada');
    return prisma.marca.update({
      where: { id: existing.id },
      data: { ...body, updatedById: request.user.sub },
    });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.marca.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Marca no encontrada');
    await prisma.marca.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default marcasRoutes;
