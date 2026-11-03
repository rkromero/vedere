// Endpoints públicos de sólo lectura para la tienda. Sólo productos PUBLICADOS.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { paginate, pageResponse, paginationQuery } from '../lib/pagination.js';
import { productoInclude, serializeProductoPublico } from '../lib/serialize.js';
import { parse } from '../lib/validate.js';
import { catalogoQuery } from '../schemas/catalogo.js';
import { buildTree, categoriaConDescendientes } from './admin/categorias.js';

const listQuery = paginationQuery.extend(catalogoQuery.shape);

const ORDER: Record<string, Prisma.ProductoOrderByWithRelationInput[]> = {
  mas_vendidos: [{ vendidos: 'desc' }, { publicadoEn: 'desc' }],
  novedades: [{ publicadoEn: 'desc' }, { createdAt: 'desc' }],
  precio_asc: [{ precio: 'asc' }, { nombre: 'asc' }],
  precio_desc: [{ precio: 'desc' }, { nombre: 'asc' }],
};

const catalogoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/productos', async (request) => {
    const q = parse(listQuery, request.query);
    const and: Prisma.ProductoWhereInput[] = [{ estado: 'PUBLICADO' }];

    if (q.q) {
      and.push({
        OR: [
          { nombre: { contains: q.q, mode: 'insensitive' } },
          { descripcion: { contains: q.q, mode: 'insensitive' } },
          { marca: { nombre: { contains: q.q, mode: 'insensitive' } } },
        ],
      });
    }
    if (q.categoria) {
      const ids = await categoriaConDescendientes(q.categoria);
      and.push({ categorias: { some: { id: { in: ids.length ? ids : ['__none__'] } } } });
    }
    if (q.linea) and.push({ linea: q.linea });
    if (q.forma) and.push({ forma: q.forma });
    if (q.material) and.push({ material: q.material });
    if (q.genero) and.push({ genero: q.genero });
    if (q.marca) and.push({ marca: { slug: q.marca } });
    if (q.coleccion) and.push({ coleccion: { slug: q.coleccion } });
    if (q.destacado) and.push({ destacado: q.destacado === 'true' });
    if (q.color) {
      and.push({
        variantes: {
          some: { activa: true, colorArmazon: { contains: q.color, mode: 'insensitive' } },
        },
      });
    }
    if (q.precioMin !== undefined) and.push({ precio: { gte: q.precioMin } });
    if (q.precioMax !== undefined) and.push({ precio: { lte: q.precioMax } });

    const where: Prisma.ProductoWhereInput = { AND: and };
    const [total, items] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        orderBy: ORDER[q.orden] ?? ORDER.novedades,
        include: productoInclude,
        ...paginate(q),
      }),
    ]);
    return pageResponse(items.map(serializeProductoPublico), total, q);
  });

  app.get<{ Params: { slug: string } }>('/productos/:slug', async (request) => {
    const p = await prisma.producto.findFirst({
      where: { slug: request.params.slug, estado: 'PUBLICADO' },
      include: productoInclude,
    });
    if (!p) throw Errors.notFound('Producto no encontrado');
    return serializeProductoPublico(p);
  });

  app.get('/categorias', async () => {
    const items = await prisma.categoria.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { productos: { where: { estado: 'PUBLICADO' } } } } },
    });
    const flat = items.map(({ _count, createdById: _c, updatedById: _u, ...c }) => ({
      ...c,
      createdById: null,
      updatedById: null,
      productos: _count.productos,
    }));
    return { items: buildTree(flat) };
  });

  app.get('/marcas', async () => {
    const items = await prisma.marca.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, slug: true, logoUrl: true },
    });
    return { items };
  });

  app.get('/colecciones', async () => {
    const now = new Date();
    const items = await prisma.coleccion.findMany({
      where: {
        activa: true,
        OR: [{ vigenciaDesde: null }, { vigenciaDesde: { lte: now } }],
        AND: [{ OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: now } }] }],
      },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        slug: true,
        colorHex: true,
        bannerUrl: true,
        vigenciaDesde: true,
        vigenciaHasta: true,
      },
    });
    return { items };
  });

  /** Valores disponibles para armar filtros en la tienda. */
  app.get('/filtros', async () => {
    const [formas, materiales, generos, colores, precio] = await Promise.all([
      prisma.producto.groupBy({
        by: ['forma'],
        where: { estado: 'PUBLICADO', forma: { not: null } },
        _count: true,
      }),
      prisma.producto.groupBy({
        by: ['material'],
        where: { estado: 'PUBLICADO', material: { not: null } },
        _count: true,
      }),
      prisma.producto.groupBy({ by: ['genero'], where: { estado: 'PUBLICADO' }, _count: true }),
      prisma.variante.groupBy({
        by: ['colorArmazon', 'colorArmazonHex'],
        where: { activa: true, producto: { estado: 'PUBLICADO' } },
        _count: true,
        orderBy: { colorArmazon: 'asc' },
      }),
      prisma.producto.aggregate({
        where: { estado: 'PUBLICADO' },
        _min: { precio: true },
        _max: { precio: true },
      }),
    ]);
    return {
      formas: formas.map((f) => ({ valor: f.forma, cantidad: f._count })),
      materiales: materiales.map((m) => ({ valor: m.material, cantidad: m._count })),
      generos: generos.map((g) => ({ valor: g.genero, cantidad: g._count })),
      colores: colores.map((c) => ({
        valor: c.colorArmazon,
        hex: c.colorArmazonHex,
        cantidad: c._count,
      })),
      precio: { min: Number(precio._min.precio ?? 0), max: Number(precio._max.precio ?? 0) },
    };
  });
};

export default catalogoRoutes;
