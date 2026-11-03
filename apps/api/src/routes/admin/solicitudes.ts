// Solicitudes de cambio / devolución (staff): bandeja, aprobación (nuevo pedido o reintegro) y rechazo.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { actorDe } from '../../lib/asignacion.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { serializePedido, serializeSolicitud } from '../../lib/pedidos.js';
import { dec } from '../../lib/serialize.js';
import { aprobarSolicitud, rechazarSolicitud } from '../../lib/solicitudes.js';
import { parse } from '../../lib/validate.js';
import { solicitudRechazarInput, solicitudResolverInput, solicitudesListQuery } from '../../schemas/checkout.js';

const listQuery = paginationQuery.extend(solicitudesListQuery.shape);

const solicitudesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where: Prisma.SolicitudCambioWhereInput = {
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.tipo ? { tipo: q.tipo } : {}),
    };
    const [total, items, pendientes] = await Promise.all([
      prisma.solicitudCambio.count({ where }),
      prisma.solicitudCambio.findMany({
        where,
        orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
        ...paginate(q),
        include: {
          pedido: { select: { id: true, numero: true, nombre: true, email: true, estado: true, total: true, optica: { select: { id: true, nombre: true } } } },
        },
      }),
      prisma.solicitudCambio.count({ where: { estado: 'PENDIENTE' } }),
    ]);
    return {
      ...pageResponse(
        items.map((s) => ({
          ...serializeSolicitud(s),
          pedido: { ...s.pedido, total: dec(s.pedido.total) ?? 0 },
        })),
        total,
        q,
      ),
      pendientes,
    };
  });

  app.post<{ Params: { id: string } }>('/:id/aprobar', async (request) => {
    const body = parse(solicitudResolverInput, request.body);
    const r = await aprobarSolicitud(request.params.id, body, { env: app.env, actor: actorDe(request.user) });
    return {
      solicitud: serializeSolicitud(r.solicitud),
      pedido: serializePedido(r.pedido, { admin: true }),
      nuevoPedido: r.nuevoPedido ? serializePedido(r.nuevoPedido, { admin: true }) : null,
    };
  });

  app.post<{ Params: { id: string } }>('/:id/rechazar', async (request) => {
    const body = parse(solicitudRechazarInput, request.body);
    const r = await rechazarSolicitud(request.params.id, body, { env: app.env, actor: actorDe(request.user) });
    return { solicitud: serializeSolicitud(r.solicitud), pedido: serializePedido(r.pedido, { admin: true }) };
  });
};

export default solicitudesRoutes;
