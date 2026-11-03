// Gestión de pedidos (staff): listado, detalle, estado/factura/notas, confirmación manual de
// transferencias, rechazo y cancelación.
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import {
  aprobarPago,
  cancelarPedido,
  pedidoInclude,
  rechazarPago,
  serializePedido,
} from '../../lib/pedidos.js';
import { dec } from '../../lib/serialize.js';
import { parse } from '../../lib/validate.js';
import { pedidoUpdate, pedidosListQuery } from '../../schemas/checkout.js';

const listQuery = paginationQuery.extend(pedidosListQuery.shape);

const pedidosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where: Prisma.PedidoWhereInput = {
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.estadoPago ? { estadoPago: q.estadoPago } : {}),
      ...(q.metodoPago ? { metodoPago: q.metodoPago } : {}),
      ...(q.opticaId ? { opticaId: q.opticaId } : {}),
      ...(q.q
        ? {
            OR: [
              { numero: { contains: q.q.toUpperCase() } },
              { email: { contains: q.q, mode: 'insensitive' } },
              { nombre: { contains: q.q, mode: 'insensitive' } },
              { dni: { contains: q.q } },
              { numeroFactura: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items, resumen] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginate(q),
        include: { optica: { select: { id: true, nombre: true } }, _count: { select: { items: true } } },
      }),
      prisma.pedido.groupBy({ by: ['estadoPago'], _count: { _all: true } }),
    ]);
    return {
      ...pageResponse(
        items.map((p) => ({
          id: p.id,
          numero: p.numero,
          estado: p.estado,
          estadoPago: p.estadoPago,
          metodoPago: p.metodoPago,
          cliente: { email: p.email, nombre: p.nombre },
          optica: p.optica,
          modalidad: p.modalidad,
          total: dec(p.total) ?? 0,
          items: p._count.items,
          numeroFactura: p.numeroFactura,
          createdAt: p.createdAt,
          pagadoEn: p.pagadoEn,
        })),
        total,
        q,
      ),
      resumen: Object.fromEntries(resumen.map((r) => [r.estadoPago, r._count._all])),
    };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, include: pedidoInclude });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    return serializePedido(p, { admin: true });
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(pedidoUpdate, request.body);
    const existing = await prisma.pedido.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Pedido no encontrado');
    if (body.estado === 'CANCELADO' && existing.estado !== 'CANCELADO') {
      const p = await cancelarPedido(existing.id, { motivo: 'Cancelado desde el admin', porId: request.user.sub });
      const { estado: _e, ...resto } = body;
      if (Object.keys(resto).length) {
        await prisma.pedido.update({ where: { id: existing.id }, data: resto });
      }
      return serializePedido(
        await prisma.pedido.findUniqueOrThrow({ where: { id: p.id }, include: pedidoInclude }),
        { admin: true },
      );
    }
    if (body.opticaId) {
      const o = await prisma.optica.findUnique({ where: { id: body.opticaId } });
      if (!o) throw Errors.badRequest('Óptica inexistente', [{ path: 'opticaId', message: 'Elegí una óptica válida' }]);
    }
    const p = await prisma.pedido.update({
      where: { id: existing.id },
      data: body,
      include: pedidoInclude,
    });
    return serializePedido(p, { admin: true });
  });

  /** Confirma a mano un pago (transferencia): APROBADO + stock descontado (una sola vez). */
  app.post<{ Params: { id: string } }>('/:id/pago/aprobar', async (request) => {
    const body = parse(z.object({ nota: z.string().trim().max(300).optional() }).optional(), request.body ?? {});
    const existing = await prisma.pedido.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Pedido no encontrado');
    if (existing.estado === 'CANCELADO') throw Errors.badRequest('El pedido está cancelado');
    const r = await aprobarPago(existing.id, {
      proveedor: existing.metodoPago === 'TRANSFERENCIA' ? 'transferencia' : 'mercadopago',
      metodo: existing.metodoPago,
      monto: dec(existing.total) ?? 0,
      confirmadoPorId: request.user.sub,
      detalle: { confirmadoManualmente: true, nota: body?.nota ?? null },
    });
    return { ...serializePedido(r.pedido, { admin: true }), yaEstaba: r.yaEstaba };
  });

  app.post<{ Params: { id: string } }>('/:id/pago/rechazar', async (request) => {
    const body = parse(z.object({ nota: z.string().trim().max(300).optional() }).optional(), request.body ?? {});
    const existing = await prisma.pedido.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Pedido no encontrado');
    if (existing.estadoPago === 'APROBADO') throw Errors.badRequest('El pago ya fue aprobado; cancelá el pedido si corresponde');
    const p = await rechazarPago(existing.id, {
      proveedor: existing.metodoPago === 'TRANSFERENCIA' ? 'transferencia' : 'mercadopago',
      metodo: existing.metodoPago,
      monto: dec(existing.total) ?? 0,
      confirmadoPorId: request.user.sub,
      detalle: { rechazadoManualmente: true, nota: body?.nota ?? null },
    });
    return serializePedido(p, { admin: true });
  });

  app.post<{ Params: { id: string } }>('/:id/cancelar', async (request) => {
    const body = parse(z.object({ motivo: z.string().trim().max(300).optional() }).optional(), request.body ?? {});
    const p = await cancelarPedido(request.params.id, { motivo: body?.motivo ?? 'Cancelado desde el admin', porId: request.user.sub });
    return serializePedido(p, { admin: true });
  });
};

export default pedidosRoutes;
