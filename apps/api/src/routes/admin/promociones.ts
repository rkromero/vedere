// ABM de reglas automáticas de promoción (2x1, segundo al 50 %, envío gratis desde un monto).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { dec } from '../../lib/serialize.js';
import { parse } from '../../lib/validate.js';
import { promocionInput, promocionUpdate } from '../../schemas/checkout.js';

const listQuery = z.object({ activa: z.enum(['true', 'false']).optional() });

const include = { coleccion: { select: { id: true, nombre: true, slug: true } } } satisfies Prisma.PromocionInclude;
type Row = Prisma.PromocionGetPayload<{ include: typeof include }>;

export function serializePromocion(p: Row) {
  const { createdById: _c, updatedById: _u, ...rest } = p;
  return { ...rest, montoMinimo: dec(p.montoMinimo) };
}

function validar(body: { tipo?: string; linea?: string | null; coleccionId?: string | null; montoMinimo?: number | null; vigenciaDesde?: Date | null; vigenciaHasta?: Date | null }) {
  if (body.vigenciaDesde && body.vigenciaHasta && body.vigenciaDesde > body.vigenciaHasta) {
    throw Errors.badRequest('La fecha de inicio no puede ser posterior a la de fin', [
      { path: 'vigenciaHasta', message: 'Debe ser posterior al inicio' },
    ]);
  }
}

const promocionesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const items = await prisma.promocion.findMany({
      where: q.activa ? { activa: q.activa === 'true' } : {},
      orderBy: [{ prioridad: 'asc' }, { createdAt: 'desc' }],
      include,
    });
    return { items: items.map(serializePromocion) };
  });

  app.post('/', async (request, reply) => {
    const body = parse(promocionInput, request.body);
    validar(body);
    if (body.coleccionId) {
      const c = await prisma.coleccion.findUnique({ where: { id: body.coleccionId } });
      if (!c) throw Errors.badRequest('Colección inexistente', [{ path: 'coleccionId', message: 'Elegí una colección válida' }]);
    }
    const p = await prisma.promocion.create({
      data: { ...body, createdById: request.user.sub, updatedById: request.user.sub },
      include,
    });
    return reply.status(201).send(serializePromocion(p));
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(promocionUpdate, request.body);
    const existing = await prisma.promocion.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Promoción no encontrada');
    validar({
      vigenciaDesde: body.vigenciaDesde ?? existing.vigenciaDesde,
      vigenciaHasta: body.vigenciaHasta ?? existing.vigenciaHasta,
    });
    if (body.coleccionId) {
      const c = await prisma.coleccion.findUnique({ where: { id: body.coleccionId } });
      if (!c) throw Errors.badRequest('Colección inexistente', [{ path: 'coleccionId', message: 'Elegí una colección válida' }]);
    }
    const p = await prisma.promocion.update({
      where: { id: existing.id },
      data: { ...body, updatedById: request.user.sub },
      include,
    });
    return serializePromocion(p);
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.promocion.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Promoción no encontrada');
    await prisma.promocion.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default promocionesRoutes;
