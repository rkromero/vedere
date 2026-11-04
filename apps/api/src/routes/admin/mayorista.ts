// B2B 2: backoffice del canal mayorista. Pedidos de ópticas (aprobar = reservar stock, cancelar,
// despachar = descontar stock, entregar) y configuración (IVA, compra mínima, envío y retiro).
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import {
  aprobarPedidoMayorista,
  cancelarPedidoMayorista,
  despacharPedidoMayorista,
  entregarPedidoMayorista,
  getConfigMayorista,
  pedidoMayoristaInclude,
  serializeConfigMayorista,
  serializePedidoMayorista,
} from '../../lib/mayorista.js';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { parse } from '../../lib/validate.js';
import {
  cancelarMayoristaInput,
  configMayoristaInput,
  despacharMayoristaInput,
  pedidosMayoristasQuery,
} from '../../schemas/mayorista.js';

const listQuery = paginationQuery.extend(pedidosMayoristasQuery.shape);

const mayoristaAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/pedidos', async (request) => {
    const q = parse(listQuery, request.query);
    const where: Prisma.PedidoMayoristaWhereInput = {
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.opticaId ? { opticaId: q.opticaId } : {}),
      ...(q.q
        ? {
            OR: [
              { numero: { contains: q.q, mode: 'insensitive' } },
              { optica: { nombre: { contains: q.q, mode: 'insensitive' } } },
              { usuarioEmail: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items, porEstado] = await Promise.all([
      prisma.pedidoMayorista.count({ where }),
      prisma.pedidoMayorista.findMany({ where, orderBy: { createdAt: 'desc' }, include: pedidoMayoristaInclude, ...paginate(q) }),
      prisma.pedidoMayorista.groupBy({ by: ['estado'], _count: true }),
    ]);
    return {
      ...pageResponse(items.map((p) => serializePedidoMayorista(p, { interno: true })), total, q),
      resumen: Object.fromEntries(porEstado.map((e) => [e.estado, e._count])),
    };
  });

  app.get<{ Params: { id: string } }>('/pedidos/:id', async (request) => {
    const p = await prisma.pedidoMayorista.findUnique({ where: { id: request.params.id }, include: pedidoMayoristaInclude });
    if (!p) throw Errors.notFound('Pedido mayorista no encontrado');
    return serializePedidoMayorista(p, { interno: true });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/aprobar', async (request) =>
    serializePedidoMayorista(await aprobarPedidoMayorista(request.params.id, request.user.sub), { interno: true }),
  );

  app.post<{ Params: { id: string } }>('/pedidos/:id/cancelar', async (request) => {
    const body = parse(cancelarMayoristaInput, request.body);
    return serializePedidoMayorista(await cancelarPedidoMayorista(request.params.id, body.motivo), { interno: true });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/despachar', async (request) => {
    const body = parse(despacharMayoristaInput, request.body ?? {});
    return serializePedidoMayorista(await despacharPedidoMayorista(request.params.id, body.numeroSeguimiento ?? null), {
      interno: true,
    });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/entregar', async (request) =>
    serializePedidoMayorista(await entregarPedidoMayorista(request.params.id), { interno: true }),
  );

  app.get('/config', async () => serializeConfigMayorista(await getConfigMayorista()));

  app.put('/config', { onRequest: app.requireRole('ADMIN') }, async (request) => {
    const body = parse(configMayoristaInput, request.body);
    await getConfigMayorista();
    const c = await prisma.configMayorista.update({
      where: { id: 'default' },
      data: { ...body, retiroDireccion: body.retiroDireccion || null, retiroHorario: body.retiroHorario || null, updatedById: request.user.sub },
    });
    return serializeConfigMayorista(c);
  });
};

export default mayoristaAdminRoutes;
