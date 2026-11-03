// ABM de ópticas socias (staff).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Optica, Prisma } from '@vedere/db';
import { rangoDiaLocal } from '../../lib/asignacion.js';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { dec } from '../../lib/serialize.js';
import { uniqueSlug } from '../../lib/slug.js';
import { parse } from '../../lib/validate.js';
import { opticaInput, opticaUpdate } from '../../schemas/tienda.js';

const listQuery = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  activa: z.enum(['true', 'false']).optional(),
  provincia: z.string().trim().max(80).optional(),
});

/** Óptica para el backoffice: Decimal → number, más carga del día y usuarios vinculados. */
export function serializeOpticaAdmin(
  o: Optica & { asignadosHoy?: number; _count?: { usuarios: number; pedidos: number } },
) {
  return {
    ...o,
    comisionPct: dec(o.comisionPct) ?? 0,
    asignadosHoy: o.asignadosHoy ?? undefined,
    usuarios: o._count?.usuarios,
    pedidos: o._count?.pedidos,
    _count: undefined,
  };
}

const opticasRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where: Prisma.OpticaWhereInput = {
      ...(q.activa ? { activa: q.activa === 'true' } : {}),
      ...(q.provincia ? { provincia: { equals: q.provincia, mode: 'insensitive' } } : {}),
    };
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      where.OR = [
        { nombre: contains },
        { razonSocial: contains },
        { cuit: contains },
        { localidad: contains },
        { direccion: contains },
        { codigoPostal: contains },
      ];
    }
    const { desde, hasta } = rangoDiaLocal();
    const [total, items, carga] = await Promise.all([
      prisma.optica.count({ where }),
      prisma.optica.findMany({
        where,
        orderBy: [{ orden: 'asc' }, { provincia: 'asc' }, { localidad: 'asc' }, { nombre: 'asc' }],
        ...paginate(q),
        include: { _count: { select: { usuarios: true, pedidos: true } } },
      }),
      prisma.pedido.groupBy({
        by: ['opticaId'],
        where: { opticaId: { not: null }, asignadoEn: { gte: desde, lt: hasta }, estado: { notIn: ['CANCELADO', 'DEVUELTO'] } },
        _count: { _all: true },
      }),
    ]);
    const hoy = new Map(carga.map((c) => [c.opticaId!, c._count._all]));
    return pageResponse(
      items.map((o) => serializeOpticaAdmin({ ...o, asignadosHoy: hoy.get(o.id) ?? 0 })),
      total,
      q,
    );
  });

  /** Todas las ópticas con coordenadas (para el mapa del backoffice). */
  app.get('/mapa', async () => {
    const items = await prisma.optica.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, slug: true, direccion: true, localidad: true, provincia: true, lat: true, lng: true, radioKm: true, activa: true, capacidadDiaria: true },
    });
    return { items };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const o = await prisma.optica.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { usuarios: true, pedidos: true } } },
    });
    if (!o) throw Errors.notFound('Óptica no encontrada');
    const usuarios = await prisma.user.findMany({
      where: { opticaId: o.id },
      select: { id: true, nombre: true, email: true, activo: true },
      orderBy: { nombre: 'asc' },
    });
    return { ...serializeOpticaAdmin(o), usuariosVinculados: usuarios };
  });

  app.post('/', async (request, reply) => {
    const body = parse(opticaInput, request.body);
    const slug = await uniqueSlug(
      body.slug ?? body.nombre + ' ' + body.localidad,
      async (s) => !!(await prisma.optica.findUnique({ where: { slug: s }, select: { id: true } })),
    );
    const o = await prisma.optica.create({
      data: {
        ...body,
        slug,
        email: body.email || null,
        createdById: request.user.sub,
        updatedById: request.user.sub,
      },
    });
    return reply.status(201).send(serializeOpticaAdmin(o));
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(opticaUpdate, request.body);
    const existing = await prisma.optica.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Óptica no encontrada');
    if (body.slug && body.slug !== existing.slug) {
      const taken = await prisma.optica.findUnique({
        where: { slug: body.slug },
        select: { id: true },
      });
      if (taken) throw Errors.conflict('Ya existe otra óptica con ese slug');
    }
    const o = await prisma.optica.update({
      where: { id: existing.id },
      data: {
        ...body,
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        updatedById: request.user.sub,
      },
    });
    return serializeOpticaAdmin(o);
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.optica.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { pedidos: true, usuarios: true } } },
    });
    if (!existing) throw Errors.notFound('Óptica no encontrada');
    if (existing._count.pedidos > 0) {
      throw Errors.conflict('La óptica tiene pedidos asociados: pausala en vez de eliminarla');
    }
    await prisma.optica.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default opticasRoutes;
