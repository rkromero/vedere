// Sitio en el backoffice (prompt 6): páginas legales, redirecciones 301 (escritura sólo ADMIN),
// arrepentimientos (Res. 424/2020) y suscriptores del newsletter.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { enviarEmail, layoutEmail } from '../../lib/email.js';
import { pageResponse, paginate } from '../../lib/pagination.js';
import { aCsv } from '../../lib/reportes.js';
import { parse } from '../../lib/validate.js';
import { serializeArrepentimiento } from '../sitio.js';
import {
  arrepentimientoUpdate,
  arrepentimientosQuery,
  newsletterAdminQuery,
  paginaLegalUpdate,
  redireccionInput,
  redireccionUpdate,
} from '../../schemas/sitio.js';

function escapar(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const sitioAdminRoutes: FastifyPluginAsync = async (app) => {
  // ---------- Páginas legales ----------
  app.get('/paginas-legales', async () => ({
    items: await prisma.paginaLegal.findMany({ orderBy: { slug: 'asc' } }),
  }));

  app.get<{ Params: { slug: string } }>('/paginas-legales/:slug', async (request) => {
    const p = await prisma.paginaLegal.findUnique({ where: { slug: request.params.slug } });
    if (!p) throw Errors.notFound('Página no encontrada');
    return p;
  });

  app.put<{ Params: { slug: string } }>('/paginas-legales/:slug', async (request) => {
    const body = parse(paginaLegalUpdate, request.body);
    const slug = request.params.slug;
    const existe = await prisma.paginaLegal.findUnique({ where: { slug }, select: { id: true } });
    if (!existe) throw Errors.notFound('Página no encontrada');
    return prisma.paginaLegal.update({
      where: { slug },
      data: { titulo: body.titulo, intro: body.intro ?? null, contenido: body.contenido, ...(body.publicada !== undefined ? { publicada: body.publicada } : {}), updatedById: request.user.sub },
    });
  });

  // ---------- Redirecciones ----------
  app.get('/redirecciones', async () => ({
    items: await prisma.redireccion.findMany({ orderBy: { origen: 'asc' } }),
  }));

  app.post('/redirecciones', { onRequest: app.requireRole('ADMIN') }, async (request, reply) => {
    const body = parse(redireccionInput, request.body);
    const dup = await prisma.redireccion.findUnique({ where: { origen: body.origen }, select: { id: true } });
    if (dup) throw Errors.conflict('Ya existe una redirección para ese origen');
    const r = await prisma.redireccion.create({ data: body });
    return reply.status(201).send(r);
  });

  app.put<{ Params: { id: string } }>('/redirecciones/:id', { onRequest: app.requireRole('ADMIN') }, async (request) => {
    const body = parse(redireccionUpdate, request.body);
    const actual = await prisma.redireccion.findUnique({ where: { id: request.params.id } });
    if (!actual) throw Errors.notFound('Redirección no encontrada');
    if (body.origen && body.origen !== actual.origen) {
      const dup = await prisma.redireccion.findUnique({ where: { origen: body.origen }, select: { id: true } });
      if (dup) throw Errors.conflict('Ya existe una redirección para ese origen');
    }
    const destino = body.destino ?? actual.destino;
    const origen = body.origen ?? actual.origen;
    if (origen === destino) throw Errors.badRequest('El destino no puede ser igual al origen');
    return prisma.redireccion.update({ where: { id: actual.id }, data: body });
  });

  app.delete<{ Params: { id: string } }>('/redirecciones/:id', { onRequest: app.requireRole('ADMIN') }, async (request, reply) => {
    const r = await prisma.redireccion.deleteMany({ where: { id: request.params.id } });
    if (r.count === 0) throw Errors.notFound('Redirección no encontrada');
    return reply.status(204).send();
  });

  // ---------- Arrepentimientos ----------
  app.get('/arrepentimientos', async (request) => {
    const q = parse(arrepentimientosQuery, request.query);
    const where: Prisma.ArrepentimientoWhereInput = {
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.q
        ? {
            OR: [
              { numeroTramite: { contains: q.q, mode: 'insensitive' } },
              { nombre: { contains: q.q, mode: 'insensitive' } },
              { email: { contains: q.q, mode: 'insensitive' } },
              { pedidoNumero: { contains: q.q, mode: 'insensitive' } },
              { dni: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [items, total, porEstado] = await Promise.all([
      prisma.arrepentimiento.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
      prisma.arrepentimiento.count({ where }),
      prisma.arrepentimiento.groupBy({ by: ['estado'], _count: { _all: true } }),
    ]);
    const resumen = { RECIBIDO: 0, EN_PROCESO: 0, RESUELTO: 0, RECHAZADO: 0 } as Record<string, number>;
    for (const e of porEstado) resumen[e.estado] = e._count._all;
    return { ...pageResponse(items.map(serializeArrepentimiento), total, q), resumen };
  });

  app.get<{ Params: { id: string } }>('/arrepentimientos/:id', async (request) => {
    const a = await prisma.arrepentimiento.findUnique({ where: { id: request.params.id } });
    if (!a) throw Errors.notFound('Trámite no encontrado');
    const pedido = a.pedidoId
      ? await prisma.pedido.findUnique({ where: { id: a.pedidoId }, select: { id: true, numero: true, estado: true, estadoPago: true, total: true, metodoPago: true } })
      : null;
    return { ...serializeArrepentimiento(a), pedido: pedido ? { ...pedido, total: Number(pedido.total) } : null };
  });

  app.put<{ Params: { id: string } }>('/arrepentimientos/:id', async (request) => {
    const body = parse(arrepentimientoUpdate, request.body);
    const a = await prisma.arrepentimiento.findUnique({ where: { id: request.params.id } });
    if (!a) throw Errors.notFound('Trámite no encontrado');
    const cierra = body.estado === 'RESUELTO' || body.estado === 'RECHAZADO';
    const actualizado = await prisma.arrepentimiento.update({
      where: { id: a.id },
      data: {
        estado: body.estado,
        respuesta: body.respuesta ?? a.respuesta,
        resueltoEn: cierra ? new Date() : null,
        resueltoPorId: cierra ? request.user.sub : null,
      },
    });
    // Al cerrar el trámite se le avisa al cliente con la respuesta.
    if (cierra && actualizado.estado !== a.estado) {
      const titulo = body.estado === 'RESUELTO' ? `Resolvimos tu trámite ${a.numeroTramite}` : `Sobre tu trámite ${a.numeroTramite}`;
      const cuerpo =
        body.estado === 'RESUELTO'
          ? `<p>Hola ${escapar(a.nombre.split(' ')[0] || a.nombre)}, tu solicitud de arrepentimiento${a.pedidoNumero ? ` del pedido <strong>${escapar(a.pedidoNumero)}</strong>` : ''} quedó resuelta.${actualizado.respuesta ? ` ${escapar(actualizado.respuesta)}` : ''}</p><p>Si corresponde un reintegro, lo vas a ver reflejado en el mismo medio de pago.</p>`
          : `<p>Hola ${escapar(a.nombre.split(' ')[0] || a.nombre)}, revisamos tu solicitud ${escapar(a.numeroTramite)} y no pudimos aprobarla.${actualizado.respuesta ? ` ${escapar(actualizado.respuesta)}` : ''} Si querés, respondé este email y lo vemos juntos.</p>`;
      await enviarEmail(
        app.env,
        { para: a.email, asunto: titulo, html: layoutEmail(app.env, { titulo, cuerpo }) },
        { pedidoId: a.pedidoId, tipo: 'ARREPENTIMIENTO_RESPUESTA' },
      );
    }
    return serializeArrepentimiento(actualizado);
  });

  // ---------- Newsletter ----------
  app.get('/newsletter', async (request) => {
    const q = parse(newsletterAdminQuery, request.query);
    const where: Prisma.SuscripcionNewsletterWhereInput = {
      ...(q.estado === 'activos' ? { bajaEn: null } : q.estado === 'bajas' ? { bajaEn: { not: null } } : {}),
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { nombre: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total, activos, bajas] = await Promise.all([
      prisma.suscripcionNewsletter.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
      prisma.suscripcionNewsletter.count({ where }),
      prisma.suscripcionNewsletter.count({ where: { bajaEn: null } }),
      prisma.suscripcionNewsletter.count({ where: { bajaEn: { not: null } } }),
    ]);
    return { ...pageResponse(items.map(sinToken), total, q), resumen: { activos, bajas } };
  });

  app.get('/newsletter/csv', async (_request, reply) => {
    const items = await prisma.suscripcionNewsletter.findMany({ orderBy: { createdAt: 'asc' } });
    const csv = aCsv(
      ['email', 'nombre', 'origen', 'alta', 'baja'],
      items.map((s) => [s.email, s.nombre ?? '', s.origen ?? '', s.createdAt, s.bajaEn]),
    );
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="vedere-newsletter-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  app.delete<{ Params: { id: string } }>('/newsletter/:id', async (request, reply) => {
    const r = await prisma.suscripcionNewsletter.deleteMany({ where: { id: request.params.id } });
    if (r.count === 0) throw Errors.notFound('Suscripción no encontrada');
    return reply.status(204).send();
  });
};

function sinToken(s: { id: string; email: string; nombre: string | null; origen: string | null; bajaEn: Date | null; createdAt: Date; updatedAt: Date }) {
  return { id: s.id, email: s.email, nombre: s.nombre, origen: s.origen, bajaEn: s.bajaEn, activa: s.bajaEn === null, createdAt: s.createdAt, updatedAt: s.updatedAt };
}

export default sitioAdminRoutes;
