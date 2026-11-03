// Bandeja del staff: mensajes de contacto, avisos de stock y suscripciones al newsletter.
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { parse } from '../../lib/validate.js';
import { contactoListQuery } from '../../schemas/tienda.js';

const contactoQuery = paginationQuery.extend(contactoListQuery.shape);
const simpleQuery = paginationQuery.extend({ q: z.string().trim().max(120).optional() });

const mensajesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/contacto', async (request) => {
    const q = parse(contactoQuery, request.query);
    const where: Prisma.MensajeContactoWhereInput = {
      ...(q.motivo ? { motivo: q.motivo } : {}),
      ...(q.leido ? { leidoEn: q.leido === 'true' ? { not: null } : null } : {}),
    };
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      where.OR = [{ nombre: contains }, { email: contains }, { mensaje: contains }];
    }
    const [total, items, sinLeer] = await Promise.all([
      prisma.mensajeContacto.count({ where }),
      prisma.mensajeContacto.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
      prisma.mensajeContacto.count({ where: { leidoEn: null } }),
    ]);
    return { ...pageResponse(items, total, q), sinLeer };
  });

  app.put<{ Params: { id: string } }>('/contacto/:id/leido', async (request) => {
    const body = parse(z.object({ leido: z.boolean().default(true) }), request.body ?? {});
    const existing = await prisma.mensajeContacto.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Mensaje no encontrado');
    return prisma.mensajeContacto.update({
      where: { id: existing.id },
      data: { leidoEn: body.leido ? new Date() : null },
    });
  });

  app.delete<{ Params: { id: string } }>('/contacto/:id', async (request, reply) => {
    const existing = await prisma.mensajeContacto.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Mensaje no encontrado');
    await prisma.mensajeContacto.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });

  app.get('/avisos-stock', async (request) => {
    const q = parse(simpleQuery, request.query);
    const where: Prisma.AvisoStockWhereInput = q.q
      ? { email: { contains: q.q, mode: 'insensitive' } }
      : {};
    const [total, items] = await Promise.all([
      prisma.avisoStock.count({ where }),
      prisma.avisoStock.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          variante: {
            select: {
              id: true,
              sku: true,
              colorArmazon: true,
              stock: true,
              producto: { select: { id: true, nombre: true, slug: true } },
            },
          },
        },
        ...paginate(q),
      }),
    ]);
    return pageResponse(items, total, q);
  });

  // Prompt 6: GET /newsletter, GET /newsletter/csv y DELETE /newsletter/:id viven en ./sitio.ts (filtro activos/bajas, resumen, CSV).
};

export default mensajesRoutes;
