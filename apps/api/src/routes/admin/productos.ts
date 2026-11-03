import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../../lib/pagination.js';
import { productoInclude, serializeProducto } from '../../lib/serialize.js';
import { uniqueSlug } from '../../lib/slug.js';
import { parse } from '../../lib/validate.js';
import {
  productoBulk,
  productoInput,
  productoListQuery,
  productoUpdate,
} from '../../schemas/catalogo.js';
import { categoriaConDescendientes } from './categorias.js';

const listQuery = paginationQuery.extend(productoListQuery.shape);

const ORDER: Record<string, Prisma.ProductoOrderByWithRelationInput[]> = {
  reciente: [{ createdAt: 'desc' }],
  actualizado: [{ updatedAt: 'desc' }],
  nombre: [{ nombre: 'asc' }],
  precio_asc: [{ precio: 'asc' }],
  precio_desc: [{ precio: 'desc' }],
  vendidos: [{ vendidos: 'desc' }, { updatedAt: 'desc' }],
};

async function validarReferencias(body: {
  marcaId?: string | null;
  coleccionId?: string | null;
  categoriaIds?: string[];
}) {
  if (body.marcaId) {
    const m = await prisma.marca.findUnique({ where: { id: body.marcaId }, select: { id: true } });
    if (!m) throw Errors.badRequest('La marca indicada no existe');
  }
  if (body.coleccionId) {
    const c = await prisma.coleccion.findUnique({
      where: { id: body.coleccionId },
      select: { id: true },
    });
    if (!c) throw Errors.badRequest('La colección indicada no existe');
  }
  if (body.categoriaIds && body.categoriaIds.length) {
    const found = await prisma.categoria.count({ where: { id: { in: body.categoriaIds } } });
    if (found !== new Set(body.categoriaIds).size) {
      throw Errors.badRequest('Alguna de las categorías indicadas no existe');
    }
  }
}

function validarSkusUnicos(variantes: Array<{ sku: string }>) {
  const seen = new Set<string>();
  for (const v of variantes) {
    if (seen.has(v.sku))
      throw Errors.conflict(`El SKU ${v.sku} está repetido en las variantes enviadas`);
    seen.add(v.sku);
  }
}

const productosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const and: Prisma.ProductoWhereInput[] = [];

    if (q.q) {
      and.push({
        OR: [
          { nombre: { contains: q.q, mode: 'insensitive' } },
          { slug: { contains: q.q, mode: 'insensitive' } },
          { variantes: { some: { sku: { contains: q.q, mode: 'insensitive' } } } },
        ],
      });
    }
    if (q.estado) and.push({ estado: q.estado });
    if (q.linea) and.push({ linea: q.linea });
    if (q.marcaId) and.push({ marcaId: q.marcaId });
    if (q.coleccionId) and.push({ coleccionId: q.coleccionId });
    if (q.forma) and.push({ forma: q.forma });
    if (q.material) and.push({ material: q.material });
    if (q.genero) and.push({ genero: q.genero });
    if (q.destacado) and.push({ destacado: q.destacado === 'true' });
    if (q.categoriaId) {
      const ids = await categoriaConDescendientes(q.categoriaId);
      and.push({ categorias: { some: { id: { in: ids.length ? ids : ['__none__'] } } } });
    }
    if (q.bajoStock === 'true') {
      // Prisma no compara dos columnas directamente: resolvemos los ids por SQL.
      const rows = await prisma.$queryRaw<{ producto_id: string }[]>`
        SELECT DISTINCT producto_id FROM variantes WHERE activa = true AND stock < stock_minimo`;
      and.push({ id: { in: rows.length ? rows.map((r) => r.producto_id) : ['__none__'] } });
    }

    const where: Prisma.ProductoWhereInput = and.length ? { AND: and } : {};
    const [total, items] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        orderBy: ORDER[q.sort] ?? ORDER.actualizado,
        include: productoInclude,
        ...paginate(q),
      }),
    ]);
    return pageResponse(items.map(serializeProducto), total, q);
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const p = await prisma.producto.findUnique({
      where: { id: request.params.id },
      include: productoInclude,
    });
    if (!p) throw Errors.notFound('Producto no encontrado');
    return serializeProducto(p);
  });

  app.post('/', async (request, reply) => {
    const body = parse(productoInput, request.body);
    await validarReferencias(body);
    validarSkusUnicos(body.variantes);

    const slug = await uniqueSlug(
      body.slug ?? body.nombre,
      async (s) =>
        !!(await prisma.producto.findUnique({ where: { slug: s }, select: { id: true } })),
    );
    const { variantes, categoriaIds, ...data } = body;
    const uid = request.user.sub;

    const created = await prisma.producto.create({
      data: {
        ...data,
        slug,
        publicadoEn: data.estado === 'PUBLICADO' ? new Date() : null,
        createdById: uid,
        updatedById: uid,
        categorias: { connect: categoriaIds.map((id) => ({ id })) },
        variantes: {
          create: variantes.map((v, i) => ({
            ...v,
            orden: v.orden ?? i,
            createdById: uid,
            updatedById: uid,
            imagenes: { create: v.imagenes.map((img, j) => ({ ...img, orden: img.orden ?? j })) },
          })),
        },
      },
      include: productoInclude,
    });
    return reply.status(201).send(serializeProducto(created));
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(productoUpdate, request.body);
    const existing = await prisma.producto.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Producto no encontrado');
    await validarReferencias(body);

    const { categoriaIds, slug: newSlug, ...data } = body;
    let slug: string | undefined;
    if (newSlug && newSlug !== existing.slug) {
      const taken = await prisma.producto.findUnique({
        where: { slug: newSlug },
        select: { id: true },
      });
      if (taken) throw Errors.conflict('Ya existe otro producto con ese slug');
      slug = newSlug;
    }

    const publicadoEn =
      data.estado === 'PUBLICADO' && existing.estado !== 'PUBLICADO' ? new Date() : undefined;

    const updated = await prisma.producto.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(slug ? { slug } : {}),
        ...(publicadoEn ? { publicadoEn } : {}),
        updatedById: request.user.sub,
        ...(categoriaIds ? { categorias: { set: categoriaIds.map((id) => ({ id })) } } : {}),
      },
      include: productoInclude,
    });
    return serializeProducto(updated);
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.producto.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Producto no encontrado');
    await prisma.producto.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });

  /** Acciones masivas: publicar, archivar, borrador, destacar, eliminar. */
  app.post('/bulk', async (request) => {
    const body = parse(productoBulk, request.body);
    const uid = request.user.sub;
    const where = { id: { in: body.ids } };

    if (body.accion === 'eliminar') {
      const r = await prisma.producto.deleteMany({ where });
      return { accion: body.accion, afectados: r.count };
    }

    const data: Prisma.ProductoUpdateManyMutationInput = { updatedById: uid };
    if (body.accion === 'publicar') {
      data.estado = 'PUBLICADO';
      data.publicadoEn = new Date();
    } else if (body.accion === 'archivar') data.estado = 'ARCHIVADO';
    else if (body.accion === 'borrador') data.estado = 'BORRADOR';
    else if (body.accion === 'destacar') data.destacado = true;
    else if (body.accion === 'no_destacar') data.destacado = false;

    const r = await prisma.producto.updateMany({ where, data });
    return { accion: body.accion, afectados: r.count };
  });
};

export default productosRoutes;
