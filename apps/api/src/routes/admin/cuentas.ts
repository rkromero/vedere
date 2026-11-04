// B2B 3: cuentas corrientes de las ópticas (staff). Listado con saldo y deuda vencida, detalle con
// movimientos, registro de pagos (con imputación a pedidos), ajustes (sólo ADMIN, con motivo),
// validación de pagos informados por las ópticas y estado de cuenta en PDF.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import {
  cuentasConSaldo,
  estadoDeCuenta,
  movimientosPaginados,
  pagoInformadoInclude,
  pedidosConDeuda,
  rechazarPagoInformado,
  registrarAjuste,
  registrarPago,
  resumenCuenta,
  serializePagoInformado,
  serializeResumen,
  totalesDeuda,
  validarPagoInformado,
} from '../../lib/cuenta-corriente.js';
import { estadoCuentaPdf } from '../../lib/documentos-mayorista.js';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { parse } from '../../lib/validate.js';
import {
  aFechaLocal,
  ajusteCuentaInput,
  motivoInput,
  movimientosQuery,
  pagoCuentaInput,
  pagosInformadosQuery,
  validarPagoInformadoInput,
} from '../../schemas/mayorista.js';
import { actorDeRequest } from './mayorista.js';

const movQuery = paginationQuery.extend(movimientosQuery.shape);
const pagosQuery = paginationQuery.extend(pagosInformadosQuery.shape);

async function opticaOr404(id: string) {
  const o = await prisma.optica.findUnique({ where: { id }, select: { id: true, nombre: true, razonSocial: true, cuit: true, email: true, activa: true } });
  if (!o) throw Errors.notFound('Óptica no encontrada');
  return o;
}

const cuentasRoutes: FastifyPluginAsync = async (app) => {
  const env = app.env;

  app.get('/', async () => {
    const [items, totales] = await Promise.all([cuentasConSaldo(), totalesDeuda()]);
    return { items, totales };
  });

  // ---------- Pagos informados por las ópticas ----------

  app.get('/pagos-informados', async (request) => {
    const q = parse(pagosQuery, request.query);
    const where: Prisma.PagoInformadoWhereInput = {
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.opticaId ? { opticaId: q.opticaId } : {}),
    };
    const [total, items, pendientes] = await Promise.all([
      prisma.pagoInformado.count({ where }),
      prisma.pagoInformado.findMany({ where, orderBy: { createdAt: 'desc' }, include: pagoInformadoInclude, ...paginate(q) }),
      prisma.pagoInformado.count({ where: { estado: 'PENDIENTE' } }),
    ]);
    return { ...pageResponse(items.map(serializePagoInformado), total, q), pendientes };
  });

  app.post<{ Params: { id: string } }>('/pagos-informados/:id/validar', async (request) => {
    const body = parse(validarPagoInformadoInput, request.body ?? {});
    return serializePagoInformado(await validarPagoInformado(env, request.params.id, actorDeRequest(request), body));
  });

  app.post<{ Params: { id: string } }>('/pagos-informados/:id/rechazar', async (request) => {
    const body = parse(motivoInput, request.body);
    return serializePagoInformado(await rechazarPagoInformado(env, request.params.id, actorDeRequest(request), body.motivo));
  });

  // ---------- Cuenta de una óptica ----------

  app.get<{ Params: { opticaId: string } }>('/:opticaId', async (request) => {
    const optica = await opticaOr404(request.params.opticaId);
    const [resumen, pendientes] = await Promise.all([resumenCuenta(optica.id), pedidosConDeuda(optica.id)]);
    return { optica, resumen: serializeResumen(resumen), pedidosPendientes: pendientes };
  });

  app.get<{ Params: { opticaId: string } }>('/:opticaId/movimientos', async (request) => {
    const optica = await opticaOr404(request.params.opticaId);
    const q = parse(movQuery, request.query);
    return movimientosPaginados(optica.id, q.page, q.pageSize, q.tipo);
  });

  app.post<{ Params: { opticaId: string } }>('/:opticaId/pagos', async (request, reply) => {
    const optica = await opticaOr404(request.params.opticaId);
    const body = parse(pagoCuentaInput, request.body);
    const mov = await registrarPago(
      optica.id,
      { ...body, fecha: body.fecha ? aFechaLocal(body.fecha) : null },
      actorDeRequest(request),
    );
    return reply.status(201).send({ id: mov.id, resumen: serializeResumen(await resumenCuenta(optica.id)) });
  });

  app.post<{ Params: { opticaId: string } }>('/:opticaId/ajustes', { onRequest: app.requireRole('ADMIN') }, async (request, reply) => {
    const optica = await opticaOr404(request.params.opticaId);
    const body = parse(ajusteCuentaInput, request.body);
    const mov = await registrarAjuste(optica.id, body, actorDeRequest(request));
    return reply.status(201).send({ id: mov.id, resumen: serializeResumen(await resumenCuenta(optica.id)) });
  });

  app.get<{ Params: { opticaId: string } }>('/:opticaId/estado.pdf', async (request, reply) => {
    const optica = await opticaOr404(request.params.opticaId);
    const [resumen, estado] = await Promise.all([resumenCuenta(optica.id), estadoDeCuenta(optica.id)]);
    const pdf = await estadoCuentaPdf({ optica, resumen, estado });
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `inline; filename="estado-de-cuenta-${optica.nombre.replace(/[^\w-]+/g, '-').toLowerCase()}.pdf"`)
      .header('cache-control', 'private, no-store')
      .send(pdf);
  });
};

export default cuentasRoutes;
