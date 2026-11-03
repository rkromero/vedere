// ABM de mensajes de la barra de promo (staff).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { promoInput, promoUpdate } from '../../schemas/tienda.js';

const listQuery = z.object({ activo: z.enum(['true', 'false']).optional() });

function validarVigencia(desde?: Date | null, hasta?: Date | null) {
  if (desde && hasta && desde > hasta) {
    throw Errors.badRequest('La fecha de inicio de vigencia no puede ser posterior a la de fin');
  }
}

const promosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const items = await prisma.promoMensaje.findMany({
      where: q.activo ? { activo: q.activo === 'true' } : {},
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
    return { items };
  });

  app.post('/', async (request, reply) => {
    const body = parse(promoInput, request.body);
    validarVigencia(body.vigenciaDesde, body.vigenciaHasta);
    const p = await prisma.promoMensaje.create({
      data: { ...body, createdById: request.user.sub, updatedById: request.user.sub },
    });
    return reply.status(201).send(p);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(promoUpdate, request.body);
    const existing = await prisma.promoMensaje.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Promo no encontrada');
    validarVigencia(
      body.vigenciaDesde ?? existing.vigenciaDesde,
      body.vigenciaHasta ?? existing.vigenciaHasta,
    );
    return prisma.promoMensaje.update({
      where: { id: existing.id },
      data: { ...body, updatedById: request.user.sub },
    });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.promoMensaje.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Promo no encontrada');
    await prisma.promoMensaje.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default promosRoutes;
