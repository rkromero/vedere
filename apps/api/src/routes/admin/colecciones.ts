import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { uniqueSlug } from '../../lib/slug.js';
import { parse } from '../../lib/validate.js';
import { coleccionInput, coleccionUpdate } from '../../schemas/catalogo.js';

const listQuery = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  activa: z.enum(['true', 'false']).optional(),
});

function validarVigencia(desde?: Date | null, hasta?: Date | null) {
  if (desde && hasta && desde > hasta) {
    throw Errors.badRequest('La fecha de inicio de vigencia no puede ser posterior a la de fin');
  }
}

const coleccionesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where = {
      ...(q.q ? { nombre: { contains: q.q, mode: 'insensitive' as const } } : {}),
      ...(q.activa ? { activa: q.activa === 'true' } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.coleccion.count({ where }),
      prisma.coleccion.findMany({
        where,
        orderBy: { nombre: 'asc' },
        include: { _count: { select: { productos: true } } },
        ...paginate(q),
      }),
    ]);
    return pageResponse(
      items.map(({ _count, ...c }) => ({ ...c, productos: _count.productos })),
      total,
      q,
    );
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const col = await prisma.coleccion.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { productos: true } } },
    });
    if (!col) throw Errors.notFound('Colección no encontrada');
    const { _count, ...c } = col;
    return { ...c, productos: _count.productos };
  });

  app.post('/', async (request, reply) => {
    const body = parse(coleccionInput, request.body);
    validarVigencia(body.vigenciaDesde, body.vigenciaHasta);
    const slug = await uniqueSlug(
      body.slug ?? body.nombre,
      async (s) =>
        !!(await prisma.coleccion.findUnique({ where: { slug: s }, select: { id: true } })),
    );
    const col = await prisma.coleccion.create({
      data: { ...body, slug, createdById: request.user.sub, updatedById: request.user.sub },
    });
    return reply.status(201).send(col);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(coleccionUpdate, request.body);
    const existing = await prisma.coleccion.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Colección no encontrada');
    validarVigencia(
      body.vigenciaDesde ?? existing.vigenciaDesde,
      body.vigenciaHasta ?? existing.vigenciaHasta,
    );
    return prisma.coleccion.update({
      where: { id: existing.id },
      data: { ...body, updatedById: request.user.sub },
    });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.coleccion.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Colección no encontrada');
    await prisma.coleccion.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default coleccionesRoutes;
