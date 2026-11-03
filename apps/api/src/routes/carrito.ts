// Carrito sincronizado con la cuenta (cualquier usuario autenticado). El navegador manda su
// snapshot; el servidor guarda el último estado y lo devuelve en otros dispositivos.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { parse } from '../lib/validate.js';
import { carritoInput } from '../schemas/tienda.js';

const carritoRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (request) => {
    const c = await prisma.carrito.findUnique({ where: { userId: request.user.sub } });
    return { items: c?.items ?? [], cupon: c?.cupon ?? null, updatedAt: c?.updatedAt ?? null };
  });

  app.put('/', async (request) => {
    const body = parse(carritoInput, request.body);
    const items = body.items as Prisma.InputJsonValue;
    const c = await prisma.carrito.upsert({
      where: { userId: request.user.sub },
      update: { items, cupon: body.cupon ?? null },
      create: { userId: request.user.sub, items, cupon: body.cupon ?? null },
    });
    return { items: c.items, cupon: c.cupon, updatedAt: c.updatedAt };
  });

  app.delete('/', async (request, reply) => {
    await prisma.carrito.deleteMany({ where: { userId: request.user.sub } });
    return reply.status(204).send();
  });
};

export default carritoRoutes;
