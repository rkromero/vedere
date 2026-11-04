// Backoffice del canal mayorista (B2B 2 + 3): pedidos de ópticas con su ciclo completo (aprobar reserva,
// preparar, despachar o listo para retirar = descuenta stock y debita la cuenta, entregar, cancelar libera),
// línea de tiempo, notas internas, factura, remito PDF, CSV, devoluciones y configuración del canal.
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { totalesDeuda } from '../../lib/cuenta-corriente.js';
import type { ActorCuenta } from '../../lib/cuenta-corriente.js';
import { remitoPdf, numeroRemito } from '../../lib/documentos-mayorista.js';
import {
  ESTADO_LABEL,
  actualizarPedidoMayorista,
  aprobarDevolucion,
  aprobarPedidoMayorista,
  asignarRemito,
  cancelarPedidoMayorista,
  cargarPedidoMayorista,
  despacharPedidoMayorista,
  entregarPedidoMayorista,
  listoParaRetiroPedidoMayorista,
  prepararPedidoMayorista,
  rechazarDevolucion,
} from '../../lib/gestion-mayorista.js';
import { rangoMes } from '../../lib/liquidacion.js';
import {
  getConfigMayorista,
  pedidoMayoristaInclude,
  round2,
  serializeConfigMayorista,
  serializeDevolucionMayorista,
  serializePedidoMayorista,
} from '../../lib/mayorista.js';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { aCsv } from '../../lib/reportes.js';
import { dec } from '../../lib/serialize.js';
import { parse } from '../../lib/validate.js';
import {
  actualizarPedidoMayoristaInput,
  aFechaLocal,
  cancelarMayoristaInput,
  configMayoristaInput,
  despacharMayoristaInput,
  devolucionesQuery,
  motivoInput,
  notaTransicionInput,
  pedidosMayoristasQuery,
} from '../../schemas/mayorista.js';

const listQuery = paginationQuery.extend(pedidosMayoristasQuery.shape);
const devQuery = paginationQuery.extend(devolucionesQuery.shape);

export function actorDeRequest(request: FastifyRequest): ActorCuenta {
  return { id: request.user.sub, nombre: request.user.nombre || request.user.email };
}

function filtrosPedidos(q: ReturnType<typeof pedidosMayoristasQuery.parse>): Prisma.PedidoMayoristaWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (q.desde) createdAt.gte = new Date(`${q.desde}T00:00:00-03:00`);
  if (q.hasta) createdAt.lt = new Date(aFechaLocal(q.hasta).getTime() + 12 * 3600_000);
  return {
    ...(q.estado ? { estado: q.estado } : {}),
    ...(q.opticaId ? { opticaId: q.opticaId } : {}),
    ...(q.entrega ? { entrega: q.entrega } : {}),
    ...(q.desde || q.hasta ? { createdAt } : {}),
    ...(q.q
      ? {
          OR: [
            { numero: { contains: q.q, mode: 'insensitive' } },
            { optica: { nombre: { contains: q.q, mode: 'insensitive' } } },
            { usuarioEmail: { contains: q.q, mode: 'insensitive' } },
            { numeroFactura: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

const devolucionInclude = {
  items: { include: { pedidoItem: { select: { nombre: true, sku: true, color: true } } } },
  pedido: { select: { id: true, numero: true } },
  optica: { select: { id: true, nombre: true } },
} satisfies Prisma.DevolucionMayoristaInclude;

const mayoristaAdminRoutes: FastifyPluginAsync = async (app) => {
  const env = app.env;
  const detalle = async (id: string) => serializePedidoMayorista(await cargarPedidoMayorista(id), { interno: true });

  app.get('/pedidos', async (request) => {
    const q = parse(listQuery, request.query);
    const where = filtrosPedidos(q);
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

  app.get('/pedidos.csv', async (request, reply) => {
    const q = parse(pedidosMayoristasQuery, request.query);
    const pedidos = await prisma.pedidoMayorista.findMany({
      where: filtrosPedidos(q),
      orderBy: { createdAt: 'asc' },
      include: pedidoMayoristaInclude,
      take: 20000,
    });
    const csv = aCsv(
      ['numero', 'fecha', 'optica', 'cuit', 'estado', 'entrega', 'unidades', 'subtotal_sin_iva', 'descuento', 'envio', 'iva', 'total', 'pagado', 'pendiente', 'vence', 'factura', 'remito', 'transporte', 'guia'],
      pedidos.map((p) => {
        const s = serializePedidoMayorista(p, { interno: true });
        return [
          p.numero,
          p.createdAt,
          p.optica.nombre,
          p.optica.cuit ?? '',
          ESTADO_LABEL[p.estado],
          p.entrega === 'RETIRO_DEPOSITO' ? 'Retiro' : 'Transporte',
          p.unidades,
          s.subtotal,
          s.descuento,
          s.envio,
          s.iva,
          s.total,
          s.pagado,
          s.pendiente,
          p.venceEn ?? '',
          p.numeroFactura ?? '',
          p.numeroRemito ? numeroRemito(p.numeroRemito) : '',
          p.transporte ?? '',
          p.numeroSeguimiento ?? '',
        ];
      }),
    );
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="pedidos-mayoristas.csv"`)
      .send(csv);
  });

  app.get<{ Params: { id: string } }>('/pedidos/:id', async (request) => detalle(request.params.id));

  app.post<{ Params: { id: string } }>('/pedidos/:id/aprobar', async (request) => {
    const body = parse(notaTransicionInput, request.body ?? {});
    return serializePedidoMayorista(await aprobarPedidoMayorista(env, request.params.id, actorDeRequest(request), body.nota), { interno: true });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/preparar', async (request) => {
    const body = parse(notaTransicionInput, request.body ?? {});
    return serializePedidoMayorista(await prepararPedidoMayorista(env, request.params.id, actorDeRequest(request), body.nota), { interno: true });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/despachar', async (request) => {
    const body = parse(despacharMayoristaInput, request.body ?? {});
    return serializePedidoMayorista(await despacharPedidoMayorista(env, request.params.id, actorDeRequest(request), body), { interno: true });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/listo-para-retiro', async (request) => {
    const body = parse(notaTransicionInput, request.body ?? {});
    return serializePedidoMayorista(await listoParaRetiroPedidoMayorista(env, request.params.id, actorDeRequest(request), body.nota), {
      interno: true,
    });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/entregar', async (request) => {
    const body = parse(notaTransicionInput, request.body ?? {});
    return serializePedidoMayorista(await entregarPedidoMayorista(env, request.params.id, actorDeRequest(request), body.nota), { interno: true });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/cancelar', async (request) => {
    const body = parse(cancelarMayoristaInput, request.body);
    return serializePedidoMayorista(await cancelarPedidoMayorista(env, request.params.id, actorDeRequest(request), body.motivo), { interno: true });
  });

  /** Notas internas, número de factura y notas en la línea de tiempo. */
  app.patch<{ Params: { id: string } }>('/pedidos/:id', async (request) => {
    const body = parse(actualizarPedidoMayoristaInput, request.body);
    return serializePedidoMayorista(await actualizarPedidoMayorista(env, request.params.id, actorDeRequest(request), body), { interno: true });
  });

  /** Remito en PDF. El número correlativo se asigna la primera vez (o al salir del depósito). */
  app.get<{ Params: { id: string } }>('/pedidos/:id/remito.pdf', async (request, reply) => {
    let p = await cargarPedidoMayorista(request.params.id);
    if (['PENDIENTE_APROBACION', 'EN_REVISION', 'CANCELADO'].includes(p.estado)) {
      throw Errors.conflict('El remito se genera cuando el pedido está aprobado');
    }
    if (!p.numeroRemito) {
      await asignarRemito(prisma, p.id);
      p = await cargarPedidoMayorista(p.id);
    }
    const pdf = await remitoPdf(p);
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `inline; filename="remito-${numeroRemito(p.numeroRemito!)}-${p.numero}.pdf"`)
      .header('cache-control', 'private, no-store')
      .send(pdf);
  });

  // ---------- Devoluciones ----------

  app.get('/devoluciones', async (request) => {
    const q = parse(devQuery, request.query);
    const where: Prisma.DevolucionMayoristaWhereInput = {
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.opticaId ? { opticaId: q.opticaId } : {}),
    };
    const [total, items, porEstado] = await Promise.all([
      prisma.devolucionMayorista.count({ where }),
      prisma.devolucionMayorista.findMany({ where, orderBy: { createdAt: 'desc' }, include: devolucionInclude, ...paginate(q) }),
      prisma.devolucionMayorista.groupBy({ by: ['estado'], _count: true }),
    ]);
    return {
      ...pageResponse(
        items.map((d) => ({ ...serializeDevolucionMayorista(d), pedido: d.pedido, optica: d.optica })),
        total,
        q,
      ),
      resumen: Object.fromEntries(porEstado.map((e) => [e.estado, e._count])),
    };
  });

  app.post<{ Params: { id: string } }>('/devoluciones/:id/aprobar', async (request) => {
    const d = await aprobarDevolucion(env, request.params.id, actorDeRequest(request));
    return { ok: true, id: d.id, pedidoId: d.pedido.id };
  });

  app.post<{ Params: { id: string } }>('/devoluciones/:id/rechazar', async (request) => {
    const body = parse(motivoInput, request.body);
    const d = await rechazarDevolucion(env, request.params.id, actorDeRequest(request), body.motivo);
    return { ok: true, id: d.id, pedidoId: d.pedidoId };
  });

  // ---------- Dashboard ----------

  app.get('/dashboard', async () => {
    const mes = rangoMes();
    const [ventas, pedidosMes, porEstado, devoluciones, pagosInformados, deuda] = await Promise.all([
      prisma.movimientoCuenta.aggregate({
        where: { tipo: 'DEBITO_PEDIDO', fecha: { gte: mes.desde, lt: mes.hasta } },
        _sum: { importe: true },
        _count: true,
      }),
      prisma.pedidoMayorista.aggregate({
        where: { createdAt: { gte: mes.desde, lt: mes.hasta }, estado: { not: 'CANCELADO' } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.pedidoMayorista.groupBy({ by: ['estado'], _count: true }),
      prisma.devolucionMayorista.count({ where: { estado: 'SOLICITADA' } }),
      prisma.pagoInformado.count({ where: { estado: 'PENDIENTE' } }),
      totalesDeuda(),
    ]);
    const estados = Object.fromEntries(porEstado.map((e) => [e.estado, e._count]));
    return {
      mes: mes.mes,
      ventasMes: round2(dec(ventas._sum.importe) ?? 0),
      pedidosDespachadosMes: ventas._count,
      pedidosMes: pedidosMes._count,
      montoPedidosMes: round2(dec(pedidosMes._sum.total) ?? 0),
      enRevision: (estados.EN_REVISION ?? 0) + (estados.PENDIENTE_APROBACION ?? 0),
      porPreparar: (estados.APROBADO ?? 0) + (estados.EN_PREPARACION ?? 0),
      devolucionesPendientes: devoluciones,
      pagosInformadosPendientes: pagosInformados,
      ...deuda,
    };
  });

  // ---------- Configuración ----------

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
