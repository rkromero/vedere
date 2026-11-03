// Variantes e imágenes de variante. Montado bajo /admin (rutas /productos/:id/variantes y /variantes/:id).
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { serializeVariante } from '../../lib/serialize.js';
import { parse } from '../../lib/validate.js';
import {
  imagenInput,
  imagenesReorder,
  varianteInput,
  varianteUpdate,
} from '../../schemas/catalogo.js';

const varianteInclude = { imagenes: { orderBy: { orden: 'asc' as const } } };

const variantesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/productos/:id/variantes', async (request) => {
    const producto = await prisma.producto.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });
    if (!producto) throw Errors.notFound('Producto no encontrado');
    const items = await prisma.variante.findMany({
      where: { productoId: producto.id },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      include: varianteInclude,
    });
    return { items: items.map(serializeVariante), total: items.length };
  });

  app.post<{ Params: { id: string } }>('/productos/:id/variantes', async (request, reply) => {
    const body = parse(varianteInput, request.body);
    const producto = await prisma.producto.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });
    if (!producto) throw Errors.notFound('Producto no encontrado');
    const uid = request.user.sub;
    const { imagenes, ...data } = body;
    const created = await prisma.variante.create({
      data: {
        ...data,
        productoId: producto.id,
        createdById: uid,
        updatedById: uid,
        imagenes: { create: imagenes.map((img, j) => ({ ...img, orden: img.orden ?? j })) },
      },
      include: varianteInclude,
    });
    return reply.status(201).send(serializeVariante(created));
  });

  app.get<{ Params: { id: string } }>('/variantes/:id', async (request) => {
    const v = await prisma.variante.findUnique({
      where: { id: request.params.id },
      include: varianteInclude,
    });
    if (!v) throw Errors.notFound('Variante no encontrada');
    return serializeVariante(v);
  });

  app.put<{ Params: { id: string } }>('/variantes/:id', async (request) => {
    const body = parse(varianteUpdate, request.body);
    const existing = await prisma.variante.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Variante no encontrada');
    const { imagenes, ...data } = body;
    const updated = await prisma.variante.update({
      where: { id: existing.id },
      data: {
        ...data,
        updatedById: request.user.sub,
        ...(imagenes
          ? {
              imagenes: {
                deleteMany: {},
                create: imagenes.map((img, j) => ({ ...img, orden: img.orden ?? j })),
              },
            }
          : {}),
      },
      include: varianteInclude,
    });
    return serializeVariante(updated);
  });

  app.delete<{ Params: { id: string } }>('/variantes/:id', async (request, reply) => {
    const existing = await prisma.variante.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Variante no encontrada');
    await prisma.variante.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });

  /** Agrega una imagen al final. */
  app.post<{ Params: { id: string } }>('/variantes/:id/imagenes', async (request, reply) => {
    const body = parse(imagenInput, request.body);
    const existing = await prisma.variante.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { imagenes: true } } },
    });
    if (!existing) throw Errors.notFound('Variante no encontrada');
    const img = await prisma.imagenVariante.create({
      data: { ...body, orden: body.orden ?? existing._count.imagenes, varianteId: existing.id },
    });
    await prisma.variante.update({
      where: { id: existing.id },
      data: { updatedById: request.user.sub },
    });
    return reply.status(201).send(img);
  });

  /** Reemplaza la lista completa de imágenes en el orden recibido (drag & drop). */
  app.put<{ Params: { id: string } }>('/variantes/:id/imagenes', async (request) => {
    const body = parse(imagenesReorder, request.body);
    const existing = await prisma.variante.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Variante no encontrada');
    const updated = await prisma.variante.update({
      where: { id: existing.id },
      data: {
        updatedById: request.user.sub,
        imagenes: {
          deleteMany: {},
          create: body.imagenes.map(({ id: _id, ...img }, j) => ({ ...img, orden: j })),
        },
      },
      include: varianteInclude,
    });
    return serializeVariante(updated);
  });

  app.delete<{ Params: { id: string; imagenId: string } }>(
    '/variantes/:id/imagenes/:imagenId',
    async (request, reply) => {
      const img = await prisma.imagenVariante.findFirst({
        where: { id: request.params.imagenId, varianteId: request.params.id },
      });
      if (!img) throw Errors.notFound('Imagen no encontrada');
      await prisma.imagenVariante.delete({ where: { id: img.id } });
      return reply.status(204).send();
    },
  );
};

export default variantesRoutes;
