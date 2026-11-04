// B2B 3: cuenta corriente de la óptica en su portal (/optica/cuenta). Sólo lectura de movimientos:
// la óptica no puede crear ni editar movimientos; lo único que puede hacer es INFORMAR un pago con su
// comprobante, que queda pendiente hasta que el admin lo valida.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import { guardarArchivo } from '../lib/archivos.js';
import {
  estadoDeCuenta,
  informarPago,
  movimientosPaginados,
  pagoInformadoInclude,
  pedidosConDeuda,
  resumenCuenta,
  serializePagoInformado,
  serializeResumen,
} from '../lib/cuenta-corriente.js';
import { estadoCuentaPdf } from '../lib/documentos-mayorista.js';
import { Errors } from '../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../lib/pagination.js';
import { parse } from '../lib/validate.js';
import { aFechaLocal, movimientosQuery, pagoInformadoInput } from '../schemas/mayorista.js';

const movQuery = paginationQuery.extend(movimientosQuery.shape);

const opticaCuentaRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.requireOptica);

  app.get('/', async (request) => {
    const opticaId = request.optica!.id;
    const [resumen, pendientes, pagosPendientes] = await Promise.all([
      resumenCuenta(opticaId),
      pedidosConDeuda(opticaId),
      prisma.pagoInformado.count({ where: { opticaId, estado: 'PENDIENTE' } }),
    ]);
    return { resumen: serializeResumen(resumen), pedidosPendientes: pendientes, pagosInformadosPendientes: pagosPendientes };
  });

  app.get('/movimientos', async (request) => {
    const q = parse(movQuery, request.query);
    return movimientosPaginados(request.optica!.id, q.page, q.pageSize, q.tipo);
  });

  app.get('/estado.pdf', async (request, reply) => {
    const o = request.optica!;
    const [resumen, estado] = await Promise.all([resumenCuenta(o.id), estadoDeCuenta(o.id)]);
    const pdf = await estadoCuentaPdf({ optica: { nombre: o.nombre, razonSocial: o.razonSocial, cuit: o.cuit }, resumen, estado });
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `inline; filename="estado-de-cuenta-vedere.pdf"`)
      .header('cache-control', 'private, no-store')
      .send(pdf);
  });

  /** Sube el comprobante (foto o PDF) y devuelve la URL para informar el pago. */
  app.post('/comprobante', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!request.isMultipart()) throw Errors.badRequest('Adjuntá el comprobante (foto o PDF)');
    const file = await request.file();
    if (!file) throw Errors.badRequest('Adjuntá el comprobante (foto o PDF)');
    return reply.status(201).send(await guardarArchivo(app.env, file, 'opticas-comprobantes', 'el comprobante'));
  });

  app.get('/pagos-informados', async (request) => {
    const q = parse(paginationQuery, request.query);
    const where = { opticaId: request.optica!.id };
    const [total, items] = await Promise.all([
      prisma.pagoInformado.count({ where }),
      prisma.pagoInformado.findMany({ where, orderBy: { createdAt: 'desc' }, include: pagoInformadoInclude, ...paginate(q) }),
    ]);
    return pageResponse(items.map(serializePagoInformado), total, q);
  });

  app.post('/pagos-informados', async (request, reply) => {
    const body = parse(pagoInformadoInput, request.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub }, select: { id: true, nombre: true } });
    const p = await informarPago(request.optica!, user, { ...body, fechaPago: aFechaLocal(body.fechaPago) });
    return reply.status(201).send(serializePagoInformado(p));
  });
};

export default opticaCuentaRoutes;
