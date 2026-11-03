// Sitio público (prompt 6): datos fiscales/config pública, páginas legales, redirecciones 301, botón de
// arrepentimiento (Res. 424/2020) con número de trámite, consulta de trámite y baja del newsletter.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { emailAdmin } from '../lib/email.js';
import { cargarConfig } from '../lib/pedidos.js';
import { enviarPlantilla } from '../lib/plantillas.js';
import { dec } from '../lib/serialize.js';
import { parse } from '../lib/validate.js';
import {
  arrepentimientoConsultaQuery,
  arrepentimientoInput,
  redireccionHitInput,
} from '../schemas/sitio.js';

const formRateLimit = { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } };
const consultaRateLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

function escapar(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const fmtFechaAR = (d: Date) =>
  d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Número de trámite ARR-<año>-<secuencia>: cuenta los del año dentro de la transacción y reintenta si colisiona. */
export async function crearArrepentimiento(data: {
  nombre: string;
  email: string;
  dni: string | null;
  telefono: string | null;
  pedidoNumero: string | null;
  pedidoId: string | null;
  motivo: string | null;
}) {
  const anio = new Date().getFullYear();
  for (let intento = 0; intento < 5; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const n = await tx.arrepentimiento.count({ where: { numeroTramite: { startsWith: `ARR-${anio}-` } } });
        const numeroTramite = `ARR-${anio}-${String(n + 1 + intento).padStart(6, '0')}`;
        return tx.arrepentimiento.create({ data: { ...data, numeroTramite } });
      });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }
  throw new Error('No se pudo generar el número de trámite');
}

export function serializeArrepentimiento(a: {
  id: string;
  numeroTramite: string;
  nombre: string;
  email: string;
  dni: string | null;
  telefono: string | null;
  pedidoNumero: string | null;
  pedidoId: string | null;
  motivo: string | null;
  estado: string;
  respuesta: string | null;
  resueltoEn: Date | null;
  resueltoPorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...a };
}

const sitioRoutes: FastifyPluginAsync = async (app) => {
  const web = app.env.WEB_URL.replace(/\/$/, '');

  /** Config pública: datos fiscales (footer/emails), programas y qué logins hay. */
  app.get('/config', async (_request, reply) => {
    const c = await cargarConfig();
    reply.header('Cache-Control', 'public, max-age=60');
    return {
      fiscal: {
        razonSocial: c.razonSocial,
        cuit: c.cuit,
        domicilioFiscal: c.domicilioFiscal,
        condicionIva: c.condicionIva,
        ingresosBrutos: c.ingresosBrutos,
        inicioActividades: c.inicioActividades,
        emailContacto: c.emailContacto,
      },
      googleLogin: !!(app.env.GOOGLE_CLIENT_ID && app.env.GOOGLE_CLIENT_SECRET),
      rivedere: { meses: c.rivedereMeses, descuentoPct: dec(c.rivedereDescuentoPct) ?? 0 },
      referidos: { descuentoPct: dec(c.referidoDescuentoPct) ?? 0 },
      carritoAbandonado: c.carritoAbandonadoHabilitado,
    };
  });

  // ---------- Páginas legales ----------
  app.get('/paginas', async (_request, reply) => {
    const items = await prisma.paginaLegal.findMany({
      where: { publicada: true },
      select: { slug: true, titulo: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
    reply.header('Cache-Control', 'public, max-age=60');
    return { items };
  });

  app.get<{ Params: { slug: string } }>('/paginas/:slug', async (request, reply) => {
    const p = await prisma.paginaLegal.findUnique({ where: { slug: request.params.slug } });
    if (!p || !p.publicada) throw Errors.notFound('Página no encontrada');
    reply.header('Cache-Control', 'public, max-age=60');
    return { slug: p.slug, titulo: p.titulo, intro: p.intro, contenido: p.contenido, updatedAt: p.updatedAt };
  });

  // ---------- Redirecciones ----------
  app.get('/redirecciones', async (_request, reply) => {
    const items = await prisma.redireccion.findMany({
      where: { activa: true },
      select: { origen: true, destino: true, permanente: true },
      orderBy: { origen: 'asc' },
    });
    reply.header('Cache-Control', 'public, max-age=60');
    return { items };
  });

  app.post('/redirecciones/hit', consultaRateLimit, async (request, reply) => {
    const body = parse(redireccionHitInput, request.body);
    await prisma.redireccion.updateMany({ where: { origen: body.origen, activa: true }, data: { hits: { increment: 1 } } });
    return reply.status(204).send();
  });

  // ---------- Botón de arrepentimiento ----------
  app.post('/arrepentimiento', formRateLimit, async (request, reply) => {
    const body = parse(arrepentimientoInput, request.body);
    if (body.web) return reply.status(201).send({ numeroTramite: 'ARR-0000-000000', createdAt: new Date() }); // honeypot

    const numero = body.pedidoNumero?.trim().toUpperCase() || null;
    const pedido = numero
      ? await prisma.pedido.findFirst({ where: { numero, email: body.email }, select: { id: true, numero: true } })
      : null;

    const a = await crearArrepentimiento({
      nombre: body.nombre,
      email: body.email,
      dni: body.dni ?? null,
      telefono: body.telefono ?? null,
      pedidoNumero: pedido?.numero ?? numero,
      pedidoId: pedido?.id ?? null,
      motivo: body.motivo ?? null,
    });

    await enviarPlantilla(app.env, {
      tipo: 'ARREPENTIMIENTO_RECIBIDO',
      para: a.email,
      vars: {
        nombre: a.nombre.split(' ')[0] || a.nombre,
        tramite: a.numeroTramite,
        pedido: a.pedidoNumero ?? 'sin número de pedido',
        fecha: fmtFechaAR(a.createdAt),
        url: `${web}/legal/arrepentimiento`,
      },
      ctaHref: `${web}/legal/arrepentimiento`,
      pedidoId: a.pedidoId,
    });
    await emailAdmin(app.env, {
      tipo: 'ADMIN_ARREPENTIMIENTO',
      asunto: `Botón de arrepentimiento · Trámite ${a.numeroTramite}`,
      cuerpoHtml: `<p><strong>${escapar(a.nombre)}</strong> (${escapar(a.email)}${a.dni ? `, DNI ${escapar(a.dni)}` : ''}${a.telefono ? `, tel. ${escapar(a.telefono)}` : ''}) pidió revocar la compra${a.pedidoNumero ? ` del pedido <strong>${escapar(a.pedidoNumero)}</strong>` : ''}.</p>${a.motivo ? `<p>Motivo: ${escapar(a.motivo)}</p>` : ''}<p>Respondé dentro de las 24 h hábiles (Res. 424/2020).</p>`,
      pedidoId: a.pedidoId,
      href: `${web}/admin/arrepentimientos`,
    });

    return reply.status(201).send({ numeroTramite: a.numeroTramite, createdAt: a.createdAt });
  });

  app.get<{ Params: { numero: string } }>('/arrepentimiento/:numero', consultaRateLimit, async (request) => {
    const q = parse(arrepentimientoConsultaQuery, request.query);
    const a = await prisma.arrepentimiento.findFirst({
      where: { numeroTramite: request.params.numero.toUpperCase(), email: q.email },
    });
    if (!a) throw Errors.notFound('No encontramos un trámite con ese número y email');
    return { numeroTramite: a.numeroTramite, estado: a.estado, respuesta: a.respuesta, createdAt: a.createdAt, resueltoEn: a.resueltoEn };
  });

  // ---------- Newsletter: baja ----------
  app.get<{ Params: { token: string } }>('/newsletter/baja/:token', consultaRateLimit, async (request) => {
    const s = await prisma.suscripcionNewsletter.findUnique({ where: { token: request.params.token } });
    if (!s) throw Errors.notFound('El link de baja no es válido');
    return { email: s.email, activa: s.bajaEn === null };
  });

  app.post<{ Params: { token: string } }>('/newsletter/baja/:token', consultaRateLimit, async (request, reply) => {
    const s = await prisma.suscripcionNewsletter.findUnique({ where: { token: request.params.token } });
    if (!s) throw Errors.notFound('El link de baja no es válido');
    if (s.bajaEn === null) {
      await prisma.suscripcionNewsletter.update({ where: { id: s.id }, data: { bajaEn: new Date() } });
    }
    return reply.status(204).send();
  });
};

export default sitioRoutes;
