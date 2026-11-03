// Gestión de pedidos (staff): listado con filtros y búsqueda, exportación CSV, detalle con línea de
// tiempo, notas internas, cambio de estado, (re)asignación de óptica, reenvío de emails, reembolsos por
// Mercado Pago, confirmación manual de transferencias y cancelación con devolución de stock.
import type { FastifyPluginAsync } from 'fastify';
import { stringify } from 'csv-stringify/sync';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import {
  actorDe,
  asignarAutomatico,
  asignarManual,
  cambiarEstado,
  cargarCandidatas,
  evaluarOpticas,
  pedidoParaEmail,
  registrarEvento,
} from '../../lib/asignacion.js';
import { emailEstadoCliente } from '../../lib/email.js';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import {
  aprobarPago,
  cancelarPedido,
  pedidoIncludeDetalle,
  rechazarPago,
  serializePedido,
} from '../../lib/pedidos.js';
import { reembolsarPedido } from '../../lib/reembolsos.js';
import { dec } from '../../lib/serialize.js';
import { parse } from '../../lib/validate.js';
import {
  asignarInput,
  cancelarInput,
  notaInternaInput,
  pedidoEstadoInput,
  pedidoUpdate,
  pedidosListQuery,
  reembolsoInput,
  reenviarEmailInput,
} from '../../schemas/checkout.js';

const listQuery = paginationQuery.extend(pedidosListQuery.shape);
type ListQuery = z.infer<typeof listQuery>;

function armarWhere(q: z.infer<typeof pedidosListQuery>): Prisma.PedidoWhereInput {
  const hasta = q.hasta ? new Date(q.hasta.getTime() + 86400_000) : undefined; // inclusivo
  return {
    ...(q.estado ? { estado: q.estado } : {}),
    ...(q.estadoPago ? { estadoPago: q.estadoPago } : {}),
    ...(q.metodoPago ? { metodoPago: q.metodoPago } : {}),
    ...(q.canal ? { canal: q.canal } : {}),
    ...(q.linea ? { items: { some: { linea: q.linea } } } : {}),
    ...(q.opticaId === 'sin' ? { opticaId: null, estado: q.estado ?? 'PAGADO' } : q.opticaId ? { opticaId: q.opticaId } : {}),
    ...(q.desde || hasta ? { createdAt: { ...(q.desde ? { gte: q.desde } : {}), ...(hasta ? { lt: hasta } : {}) } } : {}),
    ...(q.q
      ? {
          OR: [
            { numero: { contains: q.q.toUpperCase() } },
            { email: { contains: q.q, mode: 'insensitive' } },
            { nombre: { contains: q.q, mode: 'insensitive' } },
            { dni: { contains: q.q.replace(/\D/g, '') || q.q } },
            { numeroFactura: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

const COLUMNAS_CSV = [
  'numero',
  'fecha',
  'estado',
  'estado_pago',
  'metodo_pago',
  'canal',
  'cliente',
  'email',
  'dni',
  'optica',
  'modalidad',
  'localidad',
  'lineas',
  'items',
  'total',
  'pagado_en',
  'asignado_en',
  'entregado_en',
  'factura',
];

const listInclude = {
  optica: { select: { id: true, nombre: true } },
  items: { select: { linea: true, cantidad: true } },
  _count: { select: { items: true, solicitudes: true } },
} satisfies Prisma.PedidoInclude;

function filaListado(p: Prisma.PedidoGetPayload<{ include: typeof listInclude }>) {
  return {
    id: p.id,
    numero: p.numero,
    estado: p.estado,
    estadoPago: p.estadoPago,
    metodoPago: p.metodoPago,
    canal: p.canal,
    cliente: { email: p.email, nombre: p.nombre, dni: p.dni },
    optica: p.optica,
    modalidad: p.modalidad,
    localidad: p.localidad,
    lineas: [...new Set(p.items.map((i) => i.linea))],
    total: dec(p.total) ?? 0,
    items: p._count.items,
    solicitudes: p._count.solicitudes,
    numeroFactura: p.numeroFactura,
    createdAt: p.createdAt,
    pagadoEn: p.pagadoEn,
    asignadoEn: p.asignadoEn,
    aceptarAntesDe: p.aceptarAntesDe,
    entregadoEn: p.entregadoEn,
  };
}

const pedidosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q: ListQuery = parse(listQuery, request.query);
    const where = armarWhere(q);
    const [total, items, porEstado, porPago, sinAsignar, solicitudesPendientes] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q), include: listInclude }),
      prisma.pedido.groupBy({ by: ['estado'], _count: { _all: true } }),
      prisma.pedido.groupBy({ by: ['estadoPago'], _count: { _all: true } }),
      prisma.pedido.count({ where: { estado: 'PAGADO', opticaId: null } }),
      prisma.solicitudCambio.count({ where: { estado: 'PENDIENTE' } }),
    ]);
    return {
      ...pageResponse(items.map(filaListado), total, q),
      resumen: {
        porEstado: Object.fromEntries(porEstado.map((r) => [r.estado, r._count._all])),
        porPago: Object.fromEntries(porPago.map((r) => [r.estadoPago, r._count._all])),
        sinAsignar,
        solicitudesPendientes,
      },
    };
  });

  /** Exportación CSV con los mismos filtros del listado (hasta 5000 filas). */
  app.get('/export.csv', async (request, reply) => {
    const q = parse(pedidosListQuery, request.query);
    const where = armarWhere(q);
    const filas = await prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, take: 5000, include: listInclude });
    const csv = stringify(
      filas.map((p) => {
        const f = filaListado(p);
        return {
          numero: f.numero,
          fecha: f.createdAt.toISOString(),
          estado: f.estado,
          estado_pago: f.estadoPago,
          metodo_pago: f.metodoPago,
          canal: f.canal,
          cliente: f.cliente.nombre,
          email: f.cliente.email,
          dni: f.cliente.dni,
          optica: f.optica?.nombre ?? '',
          modalidad: f.modalidad,
          localidad: f.localidad,
          lineas: f.lineas.join('|'),
          items: f.items,
          total: f.total,
          pagado_en: f.pagadoEn?.toISOString() ?? '',
          asignado_en: f.asignadoEn?.toISOString() ?? '',
          entregado_en: f.entregadoEn?.toISOString() ?? '',
          factura: f.numeroFactura ?? '',
        };
      }),
      // columns explícitas: así el encabezado sale aunque no haya filas.
      { header: true, columns: COLUMNAS_CSV, delimiter: ';', bom: true },
    );
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.csv"`);
    return reply.send(csv);
  });

  /** Detalle completo + ópticas candidatas (distancia, radio, cupo) para reasignar. */
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, include: pedidoIncludeDetalle });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    const candidatas = evaluarOpticas({ lat: p.lat, lng: p.lng }, await cargarCandidatas(), p.opticasExcluidas).map((e) => ({
      id: e.optica.id,
      nombre: e.optica.nombre,
      localidad: e.optica.localidad,
      activa: e.optica.activa,
      radioKm: e.optica.radioKm,
      capacidadDiaria: e.optica.capacidadDiaria,
      asignadosHoy: e.optica.asignadosHoy,
      distanciaKm: e.distanciaKm,
      dentroRadio: e.dentroRadio,
      conCupo: e.conCupo,
      excluida: e.excluida,
      elegible: e.elegible,
      actual: e.optica.id === p.opticaId,
    }));
    return { ...serializePedido(p, { admin: true }), candidatas };
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(pedidoUpdate, request.body);
    const existing = await prisma.pedido.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Pedido no encontrado');
    const p = await prisma.pedido.update({ where: { id: existing.id }, data: body, include: pedidoIncludeDetalle });
    return serializePedido(p, { admin: true });
  });

  /** Nota interna: queda en la línea de tiempo con autor y fecha. */
  app.post<{ Params: { id: string } }>('/:id/notas', async (request) => {
    const body = parse(notaInternaInput, request.body);
    const existing = await prisma.pedido.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Pedido no encontrado');
    await registrarEvento(prisma, { pedidoId: existing.id, tipo: 'NOTA', opticaId: existing.opticaId, actor: actorDe(request.user), nota: body.nota });
    const p = await prisma.pedido.findUniqueOrThrow({ where: { id: existing.id }, include: pedidoIncludeDetalle });
    return serializePedido(p, { admin: true });
  });

  /** Cambio de estado manual (con nota). `forzar` permite saltar la secuencia normal. */
  app.post<{ Params: { id: string } }>('/:id/estado', async (request) => {
    const body = parse(pedidoEstadoInput, request.body);
    await cambiarEstado(request.params.id, body.estado, {
      env: app.env,
      actor: actorDe(request.user),
      nota: body.nota ?? null,
      numeroSeguimiento: body.numeroSeguimiento ?? undefined,
      forzar: body.forzar,
    });
    const p = await prisma.pedido.findUniqueOrThrow({ where: { id: request.params.id }, include: pedidoIncludeDetalle });
    return serializePedido(p, { admin: true });
  });

  /** Reasignación manual: óptica + motivo (queda registrado quién y por qué). */
  app.post<{ Params: { id: string } }>('/:id/asignar', async (request) => {
    const body = parse(asignarInput, request.body);
    await asignarManual(request.params.id, body.opticaId, { env: app.env, actor: actorDe(request.user), motivo: body.motivo });
    const p = await prisma.pedido.findUniqueOrThrow({ where: { id: request.params.id }, include: pedidoIncludeDetalle });
    return serializePedido(p, { admin: true });
  });

  /** Vuelve a correr la asignación automática (ej. después de activar una óptica nueva). */
  app.post<{ Params: { id: string } }>('/:id/asignar-automatico', async (request) => {
    const r = await asignarAutomatico(request.params.id, { env: app.env, actor: actorDe(request.user) });
    const p = await prisma.pedido.findUniqueOrThrow({ where: { id: request.params.id }, include: pedidoIncludeDetalle });
    return { ...serializePedido(p, { admin: true }), asignada: r.optica ? { id: r.optica.id, nombre: r.optica.nombre, distanciaKm: r.distanciaKm } : null };
  });

  /** Reenvía al cliente el email del estado actual (o del estado indicado). */
  app.post<{ Params: { id: string } }>('/:id/emails/reenviar', async (request) => {
    const body = parse(reenviarEmailInput.optional(), request.body ?? {});
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, include: pedidoIncludeDetalle });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    const estado = body?.estado ?? p.estado;
    const email = await emailEstadoCliente(app.env, pedidoParaEmail(p), estado);
    if (!email) throw Errors.badRequest('Ese estado no tiene email para el cliente');
    await registrarEvento(prisma, {
      pedidoId: p.id,
      tipo: 'EMAIL',
      opticaId: p.opticaId,
      actor: actorDe(request.user),
      nota: `Reenviado email "${email.asunto}" a ${email.para} (${email.estado.toLowerCase()})`,
      datos: { emailId: email.id, estado },
    });
    const actualizado = await prisma.pedido.findUniqueOrThrow({ where: { id: p.id }, include: pedidoIncludeDetalle });
    return { ...serializePedido(actualizado, { admin: true }), email: { id: email.id, estado: email.estado, para: email.para } };
  });

  /** Reembolso total o parcial (Mercado Pago vía API; transferencia a mano). */
  app.post<{ Params: { id: string } }>('/:id/reembolsar', async (request) => {
    const body = parse(reembolsoInput, request.body);
    const p = await reembolsarPedido(request.params.id, {
      env: app.env,
      actor: actorDe(request.user),
      motivo: body.motivo,
      monto: body.monto ?? null,
      cancelar: body.cancelar,
    });
    return serializePedido(p, { admin: true });
  });

  /** Confirma a mano un pago (transferencia): APROBADO + stock descontado (una sola vez) + asignación. */
  app.post<{ Params: { id: string } }>('/:id/pago/aprobar', async (request) => {
    const body = parse(z.object({ nota: z.string().trim().max(300).optional() }).optional(), request.body ?? {});
    const existing = await prisma.pedido.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Pedido no encontrado');
    if (existing.estado === 'CANCELADO') throw Errors.badRequest('El pedido está cancelado');
    if (existing.estado === 'DEVUELTO' || existing.estadoPago === 'REEMBOLSADO') throw Errors.badRequest('El pedido fue devuelto y reembolsado');
    const r = await aprobarPago(
      existing.id,
      {
        proveedor: existing.metodoPago === 'TRANSFERENCIA' ? 'transferencia' : 'mercadopago',
        metodo: existing.metodoPago,
        monto: dec(existing.total) ?? 0,
        confirmadoPorId: request.user.sub,
        detalle: { confirmadoManualmente: true, nota: body?.nota ?? null },
      },
      { env: app.env, actor: actorDe(request.user) },
    );
    const p = await prisma.pedido.findUniqueOrThrow({ where: { id: existing.id }, include: pedidoIncludeDetalle });
    return { ...serializePedido(p, { admin: true }), yaEstaba: r.yaEstaba };
  });

  app.post<{ Params: { id: string } }>('/:id/pago/rechazar', async (request) => {
    const body = parse(z.object({ nota: z.string().trim().max(300).optional() }).optional(), request.body ?? {});
    const existing = await prisma.pedido.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Pedido no encontrado');
    if (existing.estadoPago === 'APROBADO') throw Errors.badRequest('El pago ya fue aprobado; cancelá el pedido si corresponde');
    await rechazarPago(
      existing.id,
      {
        proveedor: existing.metodoPago === 'TRANSFERENCIA' ? 'transferencia' : 'mercadopago',
        metodo: existing.metodoPago,
        monto: dec(existing.total) ?? 0,
        confirmadoPorId: request.user.sub,
        detalle: { rechazadoManualmente: true, nota: body?.nota ?? null },
      },
      { actor: actorDe(request.user), env: app.env, nota: body?.nota ?? null },
    );
    const p = await prisma.pedido.findUniqueOrThrow({ where: { id: existing.id }, include: pedidoIncludeDetalle });
    return serializePedido(p, { admin: true });
  });

  /** Cancela: libera reservas, repone stock, avisa al cliente y (opcional) reembolsa por Mercado Pago. */
  app.post<{ Params: { id: string } }>('/:id/cancelar', async (request) => {
    const body = parse(cancelarInput, request.body);
    const existing = await prisma.pedido.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Pedido no encontrado');
    if (existing.estado === 'ENTREGADO' || existing.estado === 'DEVUELTO') {
      throw Errors.badRequest('Un pedido entregado no se cancela: gestioná una devolución o un reembolso');
    }
    if (body.reembolsar && existing.estadoPago === 'APROBADO') {
      await reembolsarPedido(existing.id, { env: app.env, actor: actorDe(request.user), motivo: body.motivo, cancelar: true });
    } else {
      await cancelarPedido(existing.id, { motivo: body.motivo, actor: actorDe(request.user), env: app.env });
    }
    const p = await prisma.pedido.findUniqueOrThrow({ where: { id: existing.id }, include: pedidoIncludeDetalle });
    return serializePedido(p, { admin: true });
  });
};

export default pedidosRoutes;
