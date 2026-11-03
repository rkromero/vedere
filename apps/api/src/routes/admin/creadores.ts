// Creadores de contenido con código propio: ABM + reporte de ventas por código (pedidos con pago aprobado).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { dec } from '../../lib/serialize.js';
import { slugify } from '../../lib/slug.js';
import { parse } from '../../lib/validate.js';
import { creadorInput, creadorUpdate, reporteQuery } from '../../schemas/checkout.js';

const listQuery = z.object({ q: z.string().trim().max(80).optional(), activo: z.enum(['true', 'false']).optional() });

const include = {
  cupones: { select: { id: true, codigo: true, activo: true, tipo: true, valor: true, usos: true } },
} satisfies Prisma.CreadorInclude;
type Row = Prisma.CreadorGetPayload<{ include: typeof include }>;

export function serializeCreador(c: Row) {
  const { createdById: _c, updatedById: _u, ...rest } = c;
  return {
    ...rest,
    comision: dec(c.comision),
    cupones: c.cupones.map((cp) => ({ ...cp, valor: dec(cp.valor) ?? 0 })),
  };
}

async function reporte(where: Prisma.CuponUsoWhereInput) {
  const usos = await prisma.cuponUso.findMany({
    where: { ...where, pedido: { estadoPago: 'APROBADO', estado: { not: 'CANCELADO' } } },
    include: {
      cupon: { select: { id: true, codigo: true, creadorId: true, creador: { select: { id: true, nombre: true, comision: true } } } },
      pedido: { select: { id: true, numero: true, total: true, subtotal: true, createdAt: true, pagadoEn: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const porCodigo = new Map<
    string,
    { cuponId: string; codigo: string; creador: { id: string; nombre: string } | null; pedidos: number; ventas: number; descuentos: number; comision: number }
  >();
  for (const u of usos) {
    const key = u.cupon.id;
    const total = dec(u.pedido.total) ?? 0;
    const pct = dec(u.cupon.creador?.comision) ?? 0;
    const prev = porCodigo.get(key) ?? {
      cuponId: u.cupon.id,
      codigo: u.cupon.codigo,
      creador: u.cupon.creador ? { id: u.cupon.creador.id, nombre: u.cupon.creador.nombre } : null,
      pedidos: 0,
      ventas: 0,
      descuentos: 0,
      comision: 0,
    };
    prev.pedidos += 1;
    prev.ventas += total;
    prev.descuentos += dec(u.monto) ?? 0;
    prev.comision += Math.round((total * pct) / 100);
    porCodigo.set(key, prev);
  }
  return {
    codigos: [...porCodigo.values()].sort((a, b) => b.ventas - a.ventas),
    pedidos: usos.map((u) => ({
      id: u.pedido.id,
      numero: u.pedido.numero,
      codigo: u.cupon.codigo,
      email: u.email,
      total: dec(u.pedido.total) ?? 0,
      descuento: dec(u.monto) ?? 0,
      fecha: u.pedido.pagadoEn ?? u.pedido.createdAt,
    })),
  };
}

function rangoFechas(q: { desde?: Date; hasta?: Date }): Prisma.CuponUsoWhereInput {
  if (!q.desde && !q.hasta) return {};
  return { createdAt: { ...(q.desde ? { gte: q.desde } : {}), ...(q.hasta ? { lte: q.hasta } : {}) } };
}

const creadoresRoutes: FastifyPluginAsync = async (app) => {
  /** Reporte de ventas por código de creador (todos los creadores). */
  app.get('/reporte', async (request) => {
    const q = parse(reporteQuery, request.query);
    return reporte({ ...rangoFechas(q), cupon: { creadorId: { not: null } } });
  });

  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const items = await prisma.creador.findMany({
      where: {
        ...(q.q ? { nombre: { contains: q.q, mode: 'insensitive' } } : {}),
        ...(q.activo ? { activo: q.activo === 'true' } : {}),
      },
      orderBy: { nombre: 'asc' },
      include,
    });
    return { items: items.map(serializeCreador) };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const c = await prisma.creador.findUnique({ where: { id: request.params.id }, include });
    if (!c) throw Errors.notFound('Creador no encontrado');
    return serializeCreador(c);
  });

  app.get<{ Params: { id: string } }>('/:id/reporte', async (request) => {
    const q = parse(reporteQuery, request.query);
    const c = await prisma.creador.findUnique({ where: { id: request.params.id } });
    if (!c) throw Errors.notFound('Creador no encontrado');
    return reporte({ ...rangoFechas(q), cupon: { creadorId: c.id } });
  });

  app.post('/', async (request, reply) => {
    const body = parse(creadorInput, request.body);
    const slug = body.slug ?? slugify(body.nombre);
    const c = await prisma.creador.create({
      data: { ...body, slug, email: body.email || null, createdById: request.user.sub, updatedById: request.user.sub },
      include,
    });
    return reply.status(201).send(serializeCreador(c));
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(creadorUpdate, request.body);
    const existing = await prisma.creador.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Creador no encontrado');
    const c = await prisma.creador.update({
      where: { id: existing.id },
      data: { ...body, ...(body.email !== undefined ? { email: body.email || null } : {}), updatedById: request.user.sub },
      include,
    });
    return serializeCreador(c);
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.creador.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Creador no encontrado');
    await prisma.creador.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default creadoresRoutes;
