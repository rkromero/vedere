// ABM de cupones de descuento (staff): porcentaje o monto, mínimo, vigencia, usos totales y por
// cliente, alcance por categorías/colecciones y creador asociado.
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
  creadorId: z.string().optional(),
});

const include = {
  categorias: { select: { id: true, nombre: true, slug: true } },
  colecciones: { select: { id: true, nombre: true, slug: true } },
  creador: { select: { id: true, nombre: true, slug: true } },
} satisfies Prisma.CuponInclude;
type CuponRow = Prisma.CuponGetPayload<{ include: typeof include }>;

export function serializeCupon(c: CuponRow) {
  const { createdById: _c, updatedById: _u, ...rest } = c;
  return { ...rest, valor: dec(c.valor) ?? 0, minimoCompra: dec(c.minimoCompra) };
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

async function validarRelaciones(body: { categoriaIds?: string[]; coleccionIds?: string[]; creadorId?: string | null }) {
  if (body.categoriaIds?.length) {
    const n = await prisma.categoria.count({ where: { id: { in: body.categoriaIds } } });
    if (n !== body.categoriaIds.length) throw Errors.badRequest('Alguna categoría no existe', [{ path: 'categoriaIds', message: 'Categoría inválida' }]);
  }
  if (body.coleccionIds?.length) {
    const n = await prisma.coleccion.count({ where: { id: { in: body.coleccionIds } } });
    if (n !== body.coleccionIds.length) throw Errors.badRequest('Alguna colección no existe', [{ path: 'coleccionIds', message: 'Colección inválida' }]);
  }
  if (body.creadorId) {
    const c = await prisma.creador.findUnique({ where: { id: body.creadorId } });
    if (!c) throw Errors.badRequest('Creador inexistente', [{ path: 'creadorId', message: 'Elegí un creador válido' }]);
  }
}

const cuponesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where: Prisma.CuponWhereInput = {
      ...(q.q ? { codigo: { contains: q.q.toUpperCase() } } : {}),
      ...(q.activo ? { activo: q.activo === 'true' } : {}),
      ...(q.creadorId ? { creadorId: q.creadorId } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.cupon.count({ where }),
      prisma.cupon.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q), include }),
    ]);
    return pageResponse(items.map(serializeCupon), total, q);
  });

  app.post('/', async (request, reply) => {
    const body = parse(cuponInput, request.body);
    validarVigencia(body.vigenciaDesde, body.vigenciaHasta);
    validarPorcentaje(body.tipo, body.valor);
    await validarRelaciones(body);
    const { categoriaIds, coleccionIds, ...data } = body;
    const c = await prisma.cupon.create({
      data: {
        ...data,
        categorias: { connect: categoriaIds.map((id) => ({ id })) },
        colecciones: { connect: coleccionIds.map((id) => ({ id })) },
        createdById: request.user.sub,
        updatedById: request.user.sub,
      },
      include,
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
    await validarRelaciones(body);
    const { categoriaIds, coleccionIds, ...data } = body;
    const c = await prisma.cupon.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(categoriaIds ? { categorias: { set: categoriaIds.map((id) => ({ id })) } } : {}),
        ...(coleccionIds ? { colecciones: { set: coleccionIds.map((id) => ({ id })) } } : {}),
        updatedById: request.user.sub,
      },
      include,
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
