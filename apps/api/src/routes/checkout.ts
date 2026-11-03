// Checkout público: configuración, cotización del carrito (promos + stock), óptica asignada,
// autocompletado/geocodificación de direcciones, receta (archivo y recetas guardadas), creación del
// pedido, consulta del pedido, comprobante de transferencia y webhook de Mercado Pago.
import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { autocompletarDireccion, geocodificar, opticaMasCercana, placesHabilitado } from '../lib/geo.js';
import { mpConfig, obtenerPago, verificarFirma } from '../lib/mercadopago.js';
import {
  cargarConfig,
  configPublica,
  cotizar,
  crearPedido,
  pedidoInclude,
  procesarPagoMP,
  serializePedido,
  serializeReceta,
} from '../lib/pedidos.js';
import { putObject } from '../lib/storage.js';
import { parse } from '../lib/validate.js';
import { serializeOptica } from './catalogo.js';
import {
  RECETA_TIPOS,
  cotizarInput,
  geocodificarInput,
  opticaQuery,
  pedidoInput,
  pedidoPublicoQuery,
  placesQuery,
} from '../schemas/checkout.js';

const formRateLimit = { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } };
const consultaRateLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

/** Lee un archivo multipart (foto o PDF) y lo guarda en R2 / disco. */
async function guardarArchivo(
  app: Parameters<FastifyPluginAsync>[0],
  file: { mimetype: string; filename: string; toBuffer: () => Promise<Buffer>; file: { truncated: boolean } },
  folder: string,
) {
  if (!RECETA_TIPOS.includes(file.mimetype as (typeof RECETA_TIPOS)[number])) {
    throw Errors.badRequest('Formato no permitido: subí una foto (JPG, PNG, WebP, HEIC) o un PDF');
  }
  const body = await file.toBuffer();
  if (file.file.truncated || body.length > app.env.MAX_UPLOAD_MB * 1024 * 1024) {
    throw Errors.badRequest(`El archivo supera los ${app.env.MAX_UPLOAD_MB} MB`);
  }
  const ext = EXT_BY_TYPE[file.mimetype] ?? 'bin';
  const key = `${folder}/${randomUUID()}.${ext}`;
  const url = await putObject(app.env, { key, body, contentType: file.mimetype });
  return { url, nombre: file.filename.slice(0, 200), tamano: body.length, tipo: file.mimetype };
}

const checkoutRoutes: FastifyPluginAsync = async (app) => {
  // request.user si hay sesión; si no, anónimo.
  app.addHook('onRequest', app.optionalAuthenticate);

  app.get('/config', async () => configPublica(await cargarConfig(), app.env));

  /** Cotiza el carrito: precios vigentes, promos automáticas, cupón, envío, cuotas y stock disponible. */
  app.post('/cotizar', consultaRateLimit, async (request) => {
    const body = parse(cotizarInput, request.body);
    const cot = await cotizar(
      {
        items: body.items,
        cupon: body.cupon,
        modalidad: body.modalidad,
        metodoPago: body.metodoPago ?? null,
        email: body.email ?? request.user?.email ?? null,
      },
      app.env,
    );
    return cot;
  });

  /** Óptica socia que atendería el pedido (por coordenadas o CP). */
  app.get('/optica', consultaRateLimit, async (request) => {
    const q = parse(opticaQuery, request.query);
    const o = await opticaMasCercana({ lat: q.lat, lng: q.lng, codigoPostal: q.cp });
    if (!o) throw Errors.notFound('Todavía no hay ópticas socias activas');
    const { distanciaKm, criterio, ...rest } = o;
    return { ...serializeOptica(rest), distanciaKm, criterio };
  });

  /** Autocompletado de direcciones (Google Places, detrás de GOOGLE_MAPS_API_KEY). */
  app.get('/direcciones', consultaRateLimit, async (request) => {
    if (!placesHabilitado(app.env)) return { habilitado: false, items: [] };
    const q = parse(placesQuery, request.query);
    const items = await autocompletarDireccion(app.env, { texto: q.q, sessionToken: q.session });
    return { habilitado: true, items };
  });

  /** Normaliza y geocodifica (placeId o texto libre). */
  app.post('/direcciones/geocodificar', consultaRateLimit, async (request) => {
    if (!placesHabilitado(app.env)) return { habilitado: false, direccion: null };
    const body = parse(geocodificarInput, request.body);
    const direccion = await geocodificar(app.env, {
      placeId: body.placeId,
      direccion: body.direccion,
      sessionToken: body.session,
    });
    return { habilitado: true, direccion };
  });

  // ---------- Receta ----------

  /** Sube la receta (foto o PDF, máx. MAX_UPLOAD_MB) y devuelve su URL para el paso de receta. */
  app.post('/recetas/archivo', formRateLimit, async (request, reply) => {
    const file = await request.file();
    if (!file) throw Errors.badRequest('Adjuntá la foto o el PDF de tu receta');
    const guardado = await guardarArchivo(app, file, 'recetas');
    return reply.status(201).send(guardado);
  });

  /** Recetas guardadas en la cuenta (para reutilizarlas). */
  app.get('/recetas', async (request) => {
    if (!request.user) throw Errors.unauthorized();
    const recetas = await prisma.receta.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return { items: recetas.map(serializeReceta) };
  });

  // ---------- Pedidos ----------

  app.post('/pedidos', formRateLimit, async (request, reply) => {
    const body = parse(pedidoInput, request.body);
    if (body.web) return reply.status(201).send({ ok: true }); // honeypot
    const { pedido, initPoint } = await crearPedido(body, {
      userId: request.user?.sub ?? null,
      env: app.env,
      log: request.log,
    });
    return reply.status(201).send({ pedido: serializePedido(pedido), initPoint });
  });

  /** Pedidos de la cuenta. */
  app.get('/mis-pedidos', async (request) => {
    if (!request.user) throw Errors.unauthorized();
    const pedidos = await prisma.pedido.findMany({
      where: { userId: request.user.sub },
      include: pedidoInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { items: pedidos.map((p) => serializePedido(p)) };
  });

  /** Detalle público del pedido: el id (cuid) actúa como clave; si hay sesión se exige que sea del usuario o coincida el email. */
  app.get<{ Params: { id: string } }>('/pedidos/:id', consultaRateLimit, async (request) => {
    const q = parse(pedidoPublicoQuery, request.query);
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, include: pedidoInclude });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    if (p.userId && request.user?.sub !== p.userId && q.email !== p.email) {
      throw Errors.forbidden('Este pedido pertenece a otra cuenta');
    }
    return serializePedido(p);
  });

  /** Comprobante de transferencia (foto o PDF). */
  app.post<{ Params: { id: string } }>('/pedidos/:id/comprobante', formRateLimit, async (request) => {
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, include: { pagos: true } });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    if (p.metodoPago !== 'TRANSFERENCIA') throw Errors.badRequest('Este pedido no se paga por transferencia');
    if (p.estadoPago === 'APROBADO') throw Errors.badRequest('El pago de este pedido ya fue confirmado');
    const file = await request.file();
    if (!file) throw Errors.badRequest('Adjuntá el comprobante');
    const guardado = await guardarArchivo(app, file, 'comprobantes');
    const pago = p.pagos[p.pagos.length - 1];
    const data = {
      comprobanteUrl: guardado.url,
      comprobanteNombre: guardado.nombre,
      comprobanteSubidoEn: new Date(),
    };
    if (pago) await prisma.pago.update({ where: { id: pago.id }, data });
    else {
      await prisma.pago.create({
        data: { pedidoId: p.id, metodo: 'TRANSFERENCIA', proveedor: 'transferencia', monto: p.total, ...data },
      });
    }
    return { ok: true, comprobanteUrl: guardado.url };
  });

  // ---------- Mercado Pago: webhook ----------

  /**
   * Notificaciones de Mercado Pago. Se verifica la firma (x-signature) con MP_WEBHOOK_SECRET y se
   * consulta el pago a la API de MP (fuente de verdad). Idempotente: el mismo evento repetido no
   * vuelve a descontar stock ni crea pagos duplicados.
   */
  app.post<{
    Querystring: { 'data.id'?: string; id?: string; type?: string; topic?: string };
    Body: { action?: string; type?: string; data?: { id?: string | number }; id?: string | number; live_mode?: boolean } | null;
  }>('/mercadopago/webhook', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (request, reply) => {
    const cfg = mpConfig(app.env);
    if (!cfg) return reply.status(503).send({ error: { code: 'MP_DISABLED', message: 'Mercado Pago no está configurado' } });

    const body = request.body ?? {};
    const query = request.query ?? {};
    const tipo = body.type ?? query.type ?? query.topic ?? 'unknown';
    const dataId = String(body.data?.id ?? query['data.id'] ?? query.id ?? '');
    const xSignature = request.headers['x-signature'] as string | undefined;
    const xRequestId = request.headers['x-request-id'] as string | undefined;

    if (cfg.webhookSecret) {
      const ok = verificarFirma({ xSignature, xRequestId, dataId, secret: cfg.webhookSecret });
      if (!ok) {
        request.log.warn({ dataId, tipo }, 'Webhook de Mercado Pago con firma inválida');
        return reply.status(401).send({ error: { code: 'INVALID_SIGNATURE', message: 'Firma inválida' } });
      }
    } else {
      request.log.warn('MP_WEBHOOK_SECRET no configurado: se acepta el webhook y se verifica el pago contra la API');
    }

    if (tipo !== 'payment' || !dataId) {
      // merchant_order, plan, etc.: se acusa recibo sin procesar.
      return reply.status(200).send({ ok: true, ignorado: tipo });
    }

    const eventoId = `${tipo}:${dataId}:${body.action ?? 'n/a'}:${xRequestId ?? 'sin-request-id'}`;
    const evento = await prisma.eventoWebhook.upsert({
      where: { proveedor_eventoId: { proveedor: 'mercadopago', eventoId } },
      update: {},
      create: { proveedor: 'mercadopago', eventoId, tipo, payload: (body ?? {}) as object },
    });

    try {
      const payment = await obtenerPago(cfg, dataId);
      const r = await procesarPagoMP(payment);
      await prisma.eventoWebhook.update({
        where: { id: evento.id },
        data: {
          procesadoEn: new Date(),
          resultado: r.pedido ? `${r.pedido.numero}:${r.estado}${r.yaEstaba ? ':repetido' : ''}` : 'sin-pedido',
        },
      });
      return reply.status(200).send({ ok: true, pedido: r.pedido?.numero ?? null, estado: r.estado, repetido: r.yaEstaba });
    } catch (err) {
      request.log.error({ err, dataId }, 'Error procesando webhook de Mercado Pago');
      await prisma.eventoWebhook.update({ where: { id: evento.id }, data: { resultado: 'error' } });
      // 500 → Mercado Pago reintenta.
      return reply.status(500).send({ error: { code: 'WEBHOOK_ERROR', message: 'No se pudo procesar la notificación' } });
    }
  });

  /** Reconsulta el estado de pago de un pedido en MP (útil cuando el webhook aún no llegó). */
  app.post<{ Params: { id: string } }>('/pedidos/:id/sincronizar-pago', consultaRateLimit, async (request) => {
    const cfg = mpConfig(app.env);
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, include: pedidoInclude });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    if (!cfg || p.metodoPago === 'TRANSFERENCIA' || p.estadoPago === 'APROBADO') return serializePedido(p);
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(p.id)}&sort=date_created&criteria=desc`,
      { headers: { Authorization: `Bearer ${cfg.accessToken}` } },
    );
    if (!res.ok) return serializePedido(p);
    const data = (await res.json()) as { results?: Array<Parameters<typeof procesarPagoMP>[0]> };
    let actual = p;
    for (const pago of data.results ?? []) {
      const r = await procesarPagoMP(pago);
      if (r.pedido) actual = r.pedido;
      if (r.estado === 'APROBADO') break;
    }
    return serializePedido(actual);
  });
};

export default checkoutRoutes;
