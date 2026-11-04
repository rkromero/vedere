// B2B 2: portal mayorista de la óptica (/optica/mayorista/*). Catálogo con el precio de ESTA óptica,
// carrito propio (no es el de la tienda), pedidos VM-xxxxx y "repetir pedido". Nunca se puede ver
// un pedido ni el descuento de otra óptica: todo sale de request.optica (403 si el pedido es de otra).
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { fichaTecnicaPdf, kitProductoZip } from '../lib/kit-producto.js';
import {
  VENDIBLE_MAYORISTA,
  cargarEnCarrito,
  confirmarPedidoMayorista,
  cotizarCarrito,
  disponibleDeProductos,
  getConfigMayorista,
  leerCarrito,
  minimoDe,
  opcionesEntrega,
  pedidoMayoristaInclude,
  productoMayoristaInclude,
  repetirPedidoMayorista,
  serializePedidoMayorista,
  serializeProductoMayorista,
} from '../lib/mayorista.js';
import { paginate, pageResponse, paginationQuery } from '../lib/pagination.js';
import { dec } from '../lib/serialize.js';
import { parse } from '../lib/validate.js';
import {
  carritoMayoristaInput,
  catalogoMayoristaQuery,
  confirmarMayoristaInput,
  pedidosMayoristasQuery,
} from '../schemas/mayorista.js';
import { categoriaConDescendientes } from './admin/categorias.js';

const listQuery = paginationQuery.extend({ pageSize: paginationQuery.shape.pageSize.default(24) }).extend(catalogoMayoristaQuery.shape);
const pedidosQuery = paginationQuery.extend(pedidosMayoristasQuery.omit({ opticaId: true }).shape);

const ORDEN: Record<string, Prisma.ProductoOrderByWithRelationInput[]> = {
  nombre: [{ nombre: 'asc' }],
  novedades: [{ publicadoEn: 'desc' }, { nombre: 'asc' }],
  precio_asc: [{ precioMayorista: 'asc' }, { nombre: 'asc' }],
  precio_desc: [{ precioMayorista: 'desc' }, { nombre: 'asc' }],
};

const opticaMayoristaRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.requireOptica);

  async function contexto(request: { optica?: { descuentoPct: Prisma.Decimal } }) {
    const cfg = await getConfigMayorista();
    return { cfg, descuentoPct: dec(request.optica!.descuentoPct) ?? 0, ivaPct: dec(cfg.ivaPct) ?? 21 };
  }

  async function productoVendible(slug: string) {
    const p = await prisma.producto.findFirst({ where: { slug, ...VENDIBLE_MAYORISTA }, include: productoMayoristaInclude });
    if (!p) throw Errors.notFound('Producto no disponible en el catálogo mayorista');
    return p;
  }

  /** Condiciones comerciales de la óptica: descuento, IVA, compra mínima y entrega. */
  app.get('/condiciones', async (request) => {
    const { cfg, descuentoPct, ivaPct } = await contexto(request);
    return {
      descuentoPct,
      ivaPct,
      minimo: minimoDe(request.optica!, cfg),
      entrega: opcionesEntrega(request.optica!, cfg),
    };
  });

  /** Valores para los filtros del catálogo (sólo de productos vendibles en el canal). */
  app.get('/filtros', async () => {
    const where = VENDIBLE_MAYORISTA;
    const [categorias, marcas, colecciones, lineas, formas, colores] = await Promise.all([
      prisma.categoria.findMany({
        where: { activa: true, productos: { some: where } },
        select: { id: true, nombre: true, slug: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.marca.findMany({ where: { productos: { some: where } }, select: { id: true, nombre: true, slug: true }, orderBy: { nombre: 'asc' } }),
      prisma.coleccion.findMany({
        where: { productos: { some: where } },
        select: { id: true, nombre: true, slug: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.producto.groupBy({ by: ['linea'], where, _count: true }),
      prisma.producto.groupBy({ by: ['forma'], where: { ...where, forma: { not: null } }, _count: true }),
      prisma.variante.groupBy({
        by: ['colorArmazon', 'colorArmazonHex'],
        where: { activa: true, producto: where },
        _count: true,
        orderBy: { colorArmazon: 'asc' },
      }),
    ]);
    return {
      categorias,
      marcas,
      colecciones,
      lineas: lineas.map((l) => ({ valor: l.linea, cantidad: l._count })),
      formas: formas.map((f) => ({ valor: f.forma, cantidad: f._count })),
      colores: colores.map((c) => ({ valor: c.colorArmazon, hex: c.colorArmazonHex, cantidad: c._count })),
    };
  });

  app.get('/productos', async (request) => {
    const q = parse(listQuery, request.query);
    const and: Prisma.ProductoWhereInput[] = [VENDIBLE_MAYORISTA];
    if (q.q) {
      for (const term of q.q.split(/\s+/).filter(Boolean).slice(0, 5)) {
        and.push({
          OR: [
            { nombre: { contains: term, mode: 'insensitive' } },
            { marca: { nombre: { contains: term, mode: 'insensitive' } } },
            { variantes: { some: { activa: true, sku: { contains: term, mode: 'insensitive' } } } },
          ],
        });
      }
    }
    if (q.categoria) {
      const ids = await categoriaConDescendientes(q.categoria);
      and.push({ categorias: { some: { id: { in: ids.length ? ids : ['__none__'] } } } });
    }
    if (q.linea?.length) and.push({ linea: { in: q.linea } });
    if (q.forma?.length) and.push({ forma: { in: q.forma } });
    if (q.marca) and.push({ marca: { slug: q.marca } });
    if (q.coleccion) and.push({ coleccion: { slug: q.coleccion } });
    if (q.color?.length) {
      and.push({
        variantes: { some: { activa: true, OR: q.color.map((c) => ({ colorArmazon: { equals: c, mode: 'insensitive' as const } })) } },
      });
    }
    if (q.soloConStock === 'true') and.push({ variantes: { some: { activa: true, stock: { gt: 0 } } } });
    const where: Prisma.ProductoWhereInput = { AND: and };
    const { descuentoPct, ivaPct } = await contexto(request);
    const [total, productos] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({ where, orderBy: ORDEN[q.orden], include: productoMayoristaInclude, ...paginate(q) }),
    ]);
    const disponible = await disponibleDeProductos(productos);
    return pageResponse(
      productos.map((p) => serializeProductoMayorista(p, { descuentoPct, ivaPct, disponible })),
      total,
      q,
    );
  });

  app.get<{ Params: { slug: string } }>('/productos/:slug', async (request) => {
    const p = await productoVendible(request.params.slug);
    const { descuentoPct, ivaPct } = await contexto(request);
    const disponible = await disponibleDeProductos([p]);
    return serializeProductoMayorista(p, { descuentoPct, ivaPct, disponible });
  });

  app.get<{ Params: { slug: string } }>('/productos/:slug/ficha.pdf', async (request, reply) => {
    const p = await productoVendible(request.params.slug);
    const pdf = await fichaTecnicaPdf(app.env, p);
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${p.slug}-ficha-tecnica.pdf"`)
      .header('cache-control', 'private, no-store')
      .send(pdf);
  });

  app.get<{ Params: { slug: string } }>(
    '/productos/:slug/kit.zip',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const p = await productoVendible(request.params.slug);
      const zip = await kitProductoZip(app.env, p);
      return reply
        .header('content-type', 'application/zip')
        .header('content-disposition', `attachment; filename="${p.slug}-vedere.zip"`)
        .header('cache-control', 'private, no-store')
        .send(zip);
    },
  );

  // ------------------------------------------------------------------
  // Carrito del portal (por usuario; independiente del carrito de la tienda)
  // ------------------------------------------------------------------

  async function respuestaCarrito(request: { user: { sub: string }; optica?: Parameters<typeof cotizarCarrito>[1] & Parameters<typeof opcionesEntrega>[0] }) {
    const cfg = await getConfigMayorista();
    const items = await leerCarrito(request.user.sub);
    const cot = await cotizarCarrito(items, request.optica!, cfg);
    return { ...cot, entrega: opcionesEntrega(request.optica!, cfg) };
  }

  app.get('/carrito', async (request) => respuestaCarrito(request));

  /** Agrega (modo sumar) o deja exactamente (modo reemplazar) las cantidades, limitadas al stock. */
  app.put('/carrito', async (request) => {
    const body = parse(carritoMayoristaInput, request.body);
    const { ajustes } = await cargarEnCarrito(request.user.sub, body.items, body.modo);
    return { ...(await respuestaCarrito(request)), ajustes };
  });

  app.delete('/carrito', async (request, reply) => {
    await prisma.carritoMayorista.deleteMany({ where: { userId: request.user.sub } });
    return reply.status(204).send();
  });

  // ------------------------------------------------------------------
  // Pedidos
  // ------------------------------------------------------------------

  async function pedidoPropio(request: { params: { id: string }; optica?: { id: string } }) {
    const p = await prisma.pedidoMayorista.findUnique({ where: { id: request.params.id }, include: pedidoMayoristaInclude });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    if (p.opticaId !== request.optica!.id) throw Errors.forbidden('Este pedido es de otra óptica');
    return p;
  }

  app.post('/pedidos', async (request, reply) => {
    const body = parse(confirmarMayoristaInput, request.body);
    if (body.repetidoDeId) {
      const origen = await prisma.pedidoMayorista.findUnique({ where: { id: body.repetidoDeId }, select: { opticaId: true } });
      if (!origen || origen.opticaId !== request.optica!.id) body.repetidoDeId = null;
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub }, select: { id: true, nombre: true, email: true } });
    const p = await confirmarPedidoMayorista(user, request.optica!, body);
    return reply.status(201).send(serializePedidoMayorista(p));
  });

  app.get('/pedidos', async (request) => {
    const q = parse(pedidosQuery, request.query);
    const where: Prisma.PedidoMayoristaWhereInput = {
      opticaId: request.optica!.id,
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.q ? { OR: [{ numero: { contains: q.q, mode: 'insensitive' } }, { items: { some: { sku: { contains: q.q, mode: 'insensitive' } } } }] } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.pedidoMayorista.count({ where }),
      prisma.pedidoMayorista.findMany({ where, orderBy: { createdAt: 'desc' }, include: pedidoMayoristaInclude, ...paginate(q) }),
    ]);
    return pageResponse(items.map((p) => serializePedidoMayorista(p)), total, q);
  });

  app.get<{ Params: { id: string } }>('/pedidos/:id', async (request) => serializePedidoMayorista(await pedidoPropio(request)));

  /** Carga los ítems del pedido en el carrito (suma a lo que haya), ajustando por stock. */
  app.post<{ Params: { id: string } }>('/pedidos/:id/repetir', async (request) => {
    const p = await pedidoPropio(request);
    const { ajustes } = await repetirPedidoMayorista(request.user.sub, p);
    return { ...(await respuestaCarrito(request)), ajustes, repetidoDe: { id: p.id, numero: p.numero } };
  });
};

export default opticaMayoristaRoutes;
