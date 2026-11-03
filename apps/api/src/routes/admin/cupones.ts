// ABM de cupones de descuento (staff).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { dec } from '../../lib/serialize.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { parse } from '../../lib/validate.js';
import { cuponInput, cuponUpdate } from '../../schemas/tienda.js';

const listQuery = paginationQuery.extend({
  q: z.string().trim().max(40).optional(),
  activo: z.enum(['true', 'false']).optional(),
});

type CuponRow = Prisma.CuponGetPayload<object>;
export function serializeCupon(c: CuponRow) {
  return { ...c, valor: dec(c.valor) ?? 0, minimoCompra: dec(c.minimoCompra) };
}

function validarVigencia(desde?: Date | null, hasta?: Date | null) {
  if (desde && hasta && desde > hasta) {
    throw Errors.badRequest('La fecha de inicio de vigencia no puede ser posterior a la de fin');
  }
}

function validarPorcentaje(tipo: string, valor: number) {
  if (tipo === 'PORCENTAJE' && valor > 100) {
    throw Errors.badRequest('Un porcentaje no puede superar 100', [
      { path: 'valor', message: 'Un porcentaje no puede superar 100' },
    ]);
  }
}

const cuponesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where: Prisma.CuponWhereInput = {
      ...(q.q ? { codigo: { contains: q.q.toUpperCase() } } : {}),
      ...(q.activo ? { activo: q.activo === 'true' } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.cupon.count({ where }),
      prisma.cupon.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
    ]);
    return pageResponse(items.map(serializeCupon), total, q);
  });

  app.post('/', async (request, reply) => {
    const body = parse(cuponInput, request.body);
    validarVigencia(body.vigenciaDesde, body.vigenciaHasta);
    validarPorcentaje(body.tipo, body.valor);
    const c = await prisma.cupon.create({
      data: { ...body, createdById: request.user.sub, updatedById: request.user.sub },
    });
    return reply.status(201).send(serializeCupon(c));
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(cuponUpdate, request.body);
    const existing = await prisma.cupon.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Cupón no encontrado');
    validarVigencia(
      body.vigenciaDesde ?? existing.vigenciaDesde,
      body.vigenciaHasta ?? existing.vigenciaHasta,
    );
    validarPorcentaje(body.tipo ?? existing.tipo, body.valor ?? dec(existing.valor) ?? 0);
    const c = await prisma.cupon.update({
      where: { id: existing.id },
      data: { ...body, updatedById: request.user.sub },
    });
    return serializeCupon(c);
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.cupon.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Cupón no encontrado');
    await prisma.cupon.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default cuponesRoutes;
