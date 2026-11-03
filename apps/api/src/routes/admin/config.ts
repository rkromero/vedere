// Configuración comercial editable (transferencia, Mercado Pago, cuotas por línea, envío).
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { ConfigTienda } from '@vedere/db';
import { mpConfig } from '../../lib/mercadopago.js';
import { cargarConfig } from '../../lib/pedidos.js';
import { dec } from '../../lib/serialize.js';
import { parse } from '../../lib/validate.js';
import { configTiendaUpdate } from '../../schemas/checkout.js';

export function serializeConfig(c: ConfigTienda) {
  return {
    transferenciaHabilitada: c.transferenciaHabilitada,
    cbu: c.cbu,
    alias: c.alias,
    titularCuenta: c.titularCuenta,
    banco: c.banco,
    descuentoTransferencia: dec(c.descuentoTransferencia) ?? 0,
    transferenciaHorasReserva: c.transferenciaHorasReserva,
    mpHabilitado: c.mpHabilitado,
    mpBilleteraHabilitada: c.mpBilleteraHabilitada,
    cuotasGeneral: c.cuotasGeneral,
    cuotasPorLinea: (c.cuotasPorLinea ?? {}) as Record<string, number>,
    costoEnvio: dec(c.costoEnvio) ?? 0,
    plazoAceptacionHoras: c.plazoAceptacionHoras,
    horaHabilDesde: c.horaHabilDesde,
    horaHabilHasta: c.horaHabilHasta,
    sabadoHabil: c.sabadoHabil,
    // Prompt 6
    razonSocial: c.razonSocial,
    cuit: c.cuit,
    domicilioFiscal: c.domicilioFiscal,
    condicionIva: c.condicionIva,
    ingresosBrutos: c.ingresosBrutos,
    inicioActividades: c.inicioActividades,
    emailContacto: c.emailContacto,
    rivedereMeses: c.rivedereMeses,
    rivedereDescuentoPct: dec(c.rivedereDescuentoPct) ?? 0,
    referidoDescuentoPct: dec(c.referidoDescuentoPct) ?? 0,
    carritoAbandonadoHabilitado: c.carritoAbandonadoHabilitado,
    updatedAt: c.updatedAt,
  };
}

const configRoutes: FastifyPluginAsync = async (app) => {
  app.get('/config-tienda', async () => {
    const c = await cargarConfig();
    const mp = mpConfig(app.env);
    return {
      ...serializeConfig(c),
      entorno: {
        mpCredenciales: !!mp,
        mpWebhookSecret: !!mp?.webhookSecret,
        mpEnabled: app.env.MP_ENABLED,
        places: !!app.env.GOOGLE_MAPS_API_KEY,
        reservaMinutos: app.env.RESERVA_STOCK_MINUTOS,
        emails: !!app.env.RESEND_API_KEY,
        adminNotifyEmail: app.env.ADMIN_NOTIFY_EMAIL ?? null,
        // Prompt 6
        googleLogin: !!(app.env.GOOGLE_CLIENT_ID && app.env.GOOGLE_CLIENT_SECRET),
        metaCapi: !!(app.env.META_PIXEL_ID && app.env.META_CAPI_TOKEN),
        ga4Mp: !!(app.env.GA4_MEASUREMENT_ID && app.env.GA4_API_SECRET),
        sentry: !!app.env.SENTRY_DSN,
        cronSecret: !!app.env.CRON_SECRET,
        carritoAbandonadoIntervaloMin: app.env.CARRITO_ABANDONADO_INTERVALO_MIN,
        rivedereIntervaloHoras: app.env.RIVEDERE_INTERVALO_HORAS,
      },
    };
  });

  app.put('/config-tienda', { onRequest: app.requireRole('ADMIN') }, async (request) => {
    const body = parse(configTiendaUpdate, request.body);
    await cargarConfig();
    const c = await prisma.configTienda.update({
      where: { id: 'default' },
      data: { ...body, updatedById: request.user.sub },
    });
    return serializeConfig(c);
  });
};

export default configRoutes;
