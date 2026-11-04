// Endpoints públicos de la tienda: catálogo (sólo productos PUBLICADOS), búsqueda, promos,
// ópticas socias, cupones, newsletter, avisos de stock y contacto.
import { EN_TIENDA } from '../lib/canales.js';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { distanciaKm } from '../lib/geo.js';
import { paginate, pageResponse, paginationQuery } from '../lib/pagination.js';
import { dec, productoInclude, serializeProductoPublico } from '../lib/serialize.js';
import { parse } from '../lib/validate.js';
import { catalogoQuery } from '../schemas/catalogo.js';
import {
  avisoStockInput,
  contactoInput,
  cuponValidar,
  opticasQuery,
  sugerenciasQuery,
} from '../schemas/tienda.js';
import { newsletterAltaInput } from '../schemas/sitio.js';
import { enviarPlantilla } from '../lib/plantillas.js';
import { buildTree, categoriaConDescendientes } from './admin/categorias.js';

const listQuery = paginationQuery.extend(catalogoQuery.shape);

const ORDER: Record<string, Prisma.ProductoOrderByWithRelationInput[]> = {
  mas_vendidos: [{ vendidos: 'desc' }, { publicadoEn: 'desc' }],
  novedades: [{ publicadoEn: 'desc' }, { createdAt: 'desc' }],
  precio_asc: [{ precio: 'asc' }, { nombre: 'asc' }],
  precio_desc: [{ precio: 'desc' }, { nombre: 'asc' }],
  relevancia: [{ destacado: 'desc' }, { vendidos: 'desc' }, { publicadoEn: 'desc' }],
};

/** Rate limit más estricto para formularios públicos (por IP). */
const formRateLimit = { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } };

function vigente(now: Date): Prisma.PromoMensajeWhereInput {
  return {
    OR: [{ vigenciaDesde: null }, { vigenciaDesde: { lte: now } }],
    AND: [{ OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: now } }] }],
  };
}

/** Campos internos de la óptica que nunca salen en endpoints públicos (comisión, condiciones mayoristas, papeles). */
const OPTICA_PRIVADO = [
  'createdById',
  'updatedById',
  'comisionPct',
  'capacidadDiaria',
  'descuentoPct',
  'minimoTipo',
  'minimoValor',
  'habilitacionUrl',
  'condicionIva',
  'orden',
] as const;

export function serializeOptica<T extends object>(o: T): Omit<T, (typeof OPTICA_PRIVADO)[number]> {
  const rest = { ...o } as Record<string, unknown>;
  for (const k of OPTICA_PRIVADO) delete rest[k];
  return rest as Omit<T, (typeof OPTICA_PRIVADO)[number]>;
}

const catalogoRoutes: FastifyPluginAsync = async (app) => {
  // ------------------------------------------------------------------
  // Productos
  // ------------------------------------------------------------------
  app.get('/productos', async (request) => {
    const q = parse(listQuery, request.query);
    const and: Prisma.ProductoWhereInput[] = [{ ...EN_TIENDA }];

    if (q.q) {
      const terms = q.q.split(/\s+/).filter(Boolean).slice(0, 5);
      for (const term of terms) {
        and.push({
          OR: [
            { nombre: { contains: term, mode: 'insensitive' } },
            { descripcion: { contains: term, mode: 'insensitive' } },
            { marca: { nombre: { contains: term, mode: 'insensitive' } } },
            { coleccion: { nombre: { contains: term, mode: 'insensitive' } } },
            { variantes: { some: { colorArmazon: { contains: term, mode: 'insensitive' } } } },
          ],
        });
      }
    }
    if (q.categoria) {
      const ids = await categoriaConDescendientes(q.categoria);
      and.push({ categorias: { some: { id: { in: ids.length ? ids : ['__none__'] } } } });
    }
    if (q.linea) and.push({ linea: { in: q.linea } });
    if (q.forma) and.push({ forma: { in: q.forma } });
    if (q.material) and.push({ material: { in: q.material } });
    if (q.genero) and.push({ genero: { in: q.genero } });
    if (q.marca) and.push({ marca: { slug: q.marca } });
    if (q.coleccion) and.push({ coleccion: { slug: q.coleccion } });
    if (q.slugs) and.push({ slug: { in: q.slugs } });
    if (q.destacado) and.push({ destacado: q.destacado === 'true' });
    if (q.receta) and.push({ permiteReceta: q.receta === 'true' });
    if (q.color) {
      and.push({
        variantes: {
          some: {
            activa: true,
            OR: q.color.map((c) => ({ colorArmazon: { contains: c, mode: 'insensitive' } })),
          },
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
      where: { slug: request.params.slug, ...EN_TIENDA },
      include: productoInclude,
    });
    if (!p) throw Errors.notFound('Producto no encontrado');
    return serializeProductoPublico(p);
  });

  /** Relacionados: misma colección o forma o línea, los más vendidos primero. */
  app.get<{ Params: { slug: string } }>('/productos/:slug/relacionados', async (request) => {
    const p = await prisma.producto.findFirst({
      where: { slug: request.params.slug, ...EN_TIENDA },
      select: { id: true, linea: true, forma: true, coleccionId: true },
    });
    if (!p) throw Errors.notFound('Producto no encontrado');
    const or: Prisma.ProductoWhereInput[] = [{ linea: p.linea }];
    if (p.forma) or.unshift({ forma: p.forma });
    if (p.coleccionId) or.unshift({ coleccionId: p.coleccionId });
    const items = await prisma.producto.findMany({
      where: { ...EN_TIENDA, id: { not: p.id }, OR: or },
      orderBy: [{ vendidos: 'desc' }, { publicadoEn: 'desc' }],
      include: productoInclude,
      take: 8,
    });
    // Prioridad: misma colección > misma forma > misma línea.
    const score = (x: (typeof items)[number]) =>
      (x.coleccionId && x.coleccionId === p.coleccionId ? 4 : 0) +
      (x.forma && x.forma === p.forma ? 2 : 0) +
      (x.linea === p.linea ? 1 : 0);
    items.sort((a, b) => score(b) - score(a));
    return { items: items.map(serializeProductoPublico) };
  });

  /** Sugerencias en vivo para el buscador: productos, categorías y colecciones. */
  app.get('/sugerencias', async (request) => {
    const { q } = parse(sugerenciasQuery, request.query);
    const contains = { contains: q, mode: 'insensitive' as const };
    const [productos, categorias, colecciones] = await Promise.all([
      prisma.producto.findMany({
        where: {
          ...EN_TIENDA,
          OR: [
            { nombre: contains },
            { marca: { nombre: contains } },
            { variantes: { some: { activa: true, colorArmazon: contains } } },
          ],
        },
        orderBy: [{ vendidos: 'desc' }, { publicadoEn: 'desc' }],
        include: productoInclude,
        take: 6,
      }),
      prisma.categoria.findMany({
        where: { activa: true, nombre: contains },
        select: { id: true, nombre: true, slug: true },
        take: 4,
      }),
      prisma.coleccion.findMany({
        where: { activa: true, nombre: contains },
        select: { id: true, nombre: true, slug: true, colorHex: true },
        take: 3,
      }),
    ]);
    return {
      productos: productos.map((p) => {
        const s = serializeProductoPublico(p);
        return {
          id: s.id,
          nombre: s.nombre,
          slug: s.slug,
          linea: s.linea,
          precio: s.precio,
          precioLista: s.precioLista,
          imagen: s.variantes[0]?.imagenes[0]?.urlMiniatura ?? s.imagenPrincipal,
          marca: s.marca?.nombre ?? null,
        };
      }),
      categorias,
      colecciones,
    };
  });

  app.get('/categorias', async () => {
    const items = await prisma.categoria.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { productos: { where: { ...EN_TIENDA } } } } },
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
      orderBy: [{ vigenciaDesde: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        slug: true,
        colorHex: true,
        bannerUrl: true,
        vigenciaDesde: true,
        vigenciaHasta: true,
        _count: { select: { productos: { where: { ...EN_TIENDA } } } },
        productos: {
          where: { ...EN_TIENDA },
          orderBy: [{ destacado: 'desc' }, { vendidos: 'desc' }],
          take: 1,
          select: {
            variantes: {
              where: { activa: true },
              orderBy: { orden: 'asc' },
              take: 1,
              select: {
                imagenes: {
                  orderBy: { orden: 'asc' },
                  take: 1,
                  select: { url: true, urlMediana: true },
                },
              },
            },
          },
        },
      },
    });
    return {
      items: items.map(({ _count, productos, ...c }) => {
        const img = productos[0]?.variantes[0]?.imagenes[0];
        return {
          ...c,
          productos: _count.productos,
          portadaUrl: c.bannerUrl ?? img?.url ?? null,
          portadaMedianaUrl: c.bannerUrl ?? img?.urlMediana ?? img?.url ?? null,
        };
      }),
    };
  });

  /** Valores disponibles para armar filtros en la tienda. */
  app.get('/filtros', async () => {
    const [formas, materiales, generos, lineas, colores, precio] = await Promise.all([
      prisma.producto.groupBy({
        by: ['forma'],
        where: { ...EN_TIENDA, forma: { not: null } },
        _count: true,
      }),
      prisma.producto.groupBy({
        by: ['material'],
        where: { ...EN_TIENDA, material: { not: null } },
        _count: true,
      }),
      prisma.producto.groupBy({ by: ['genero'], where: { ...EN_TIENDA }, _count: true }),
      prisma.producto.groupBy({ by: ['linea'], where: { ...EN_TIENDA }, _count: true }),
      prisma.variante.groupBy({
        by: ['colorArmazon', 'colorArmazonHex'],
        where: { activa: true, producto: { ...EN_TIENDA } },
        _count: true,
        orderBy: { colorArmazon: 'asc' },
      }),
      prisma.producto.aggregate({
        where: { ...EN_TIENDA },
        _min: { precio: true },
        _max: { precio: true },
      }),
    ]);
    return {
      formas: formas.map((f) => ({ valor: f.forma, cantidad: f._count })),
      materiales: materiales.map((m) => ({ valor: m.material, cantidad: m._count })),
      generos: generos.map((g) => ({ valor: g.genero, cantidad: g._count })),
      lineas: lineas.map((l) => ({ valor: l.linea, cantidad: l._count })),
      colores: colores.map((c) => ({
        valor: c.colorArmazon,
        hex: c.colorArmazonHex,
        cantidad: c._count,
      })),
      precio: { min: Number(precio._min.precio ?? 0), max: Number(precio._max.precio ?? 0) },
    };
  });

  // ------------------------------------------------------------------
  // Promos de la barra superior
  // ------------------------------------------------------------------
  app.get('/promos', async () => {
    const items = await prisma.promoMensaje.findMany({
      where: { activo: true, ...vigente(new Date()) },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, texto: true, link: true },
    });
    return { items };
  });

  // ------------------------------------------------------------------
  // Ópticas socias (buscador por código postal / cercanía)
  // ------------------------------------------------------------------
  app.get('/opticas', async (request) => {
    const q = parse(opticasQuery, request.query);
    const where: Prisma.OpticaWhereInput = { activa: true };
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      where.OR = [
        { nombre: contains },
        { localidad: contains },
        { provincia: contains },
        { direccion: contains },
        { codigoPostal: contains },
      ];
    }
    const opticas = await prisma.optica.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { provincia: 'asc' }, { localidad: 'asc' }, { nombre: 'asc' }],
    });

    const cp = q.cp ? Number(q.cp) : null;
    const conDistancia = opticas.map((o) => {
      const cpOptica = Number(o.codigoPostal.replace(/\D/g, '').slice(0, 4));
      const distanciaCp =
        cp !== null && Number.isFinite(cpOptica) ? Math.abs(cpOptica - cp) : null;
      const km =
        q.lat !== undefined && q.lng !== undefined && o.lat !== null && o.lng !== null
          ? Math.round(distanciaKm(q.lat, q.lng, o.lat, o.lng) * 10) / 10
          : null;
      return { ...serializeOptica(o), distanciaKm: km, distanciaCp };
    });

    if (q.lat !== undefined && q.lng !== undefined) {
      conDistancia.sort((a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9));
    } else if (cp !== null) {
      conDistancia.sort((a, b) => (a.distanciaCp ?? 1e9) - (b.distanciaCp ?? 1e9));
    }
    return { items: conDistancia.slice(0, q.limit), total: conDistancia.length };
  });

  app.get<{ Params: { slug: string } }>('/opticas/:slug', async (request) => {
    const o = await prisma.optica.findFirst({
      where: { slug: request.params.slug, activa: true },
    });
    if (!o) throw Errors.notFound('Óptica no encontrada');
    return serializeOptica(o);
  });

  // ------------------------------------------------------------------
  // Cupones: validación para el carrito (el consumo real es en el checkout)
  // ------------------------------------------------------------------
  app.post('/cupones/validar', formRateLimit, async (request) => {
    const body = parse(cuponValidar, request.body);
    const cupon = await prisma.cupon.findUnique({ where: { codigo: body.codigo.toUpperCase() } });
    const now = new Date();
    if (!cupon || !cupon.activo) throw Errors.notFound('Ese cupón no existe o ya no está vigente');
    if (cupon.vigenciaDesde && cupon.vigenciaDesde > now)
      throw Errors.badRequest('Ese cupón todavía no está vigente');
    if (cupon.vigenciaHasta && cupon.vigenciaHasta < now)
      throw Errors.badRequest('Ese cupón ya venció');
    if (cupon.usosMax !== null && cupon.usos >= cupon.usosMax)
      throw Errors.badRequest('Ese cupón ya alcanzó el máximo de usos');
    const minimo = dec(cupon.minimoCompra);
    if (minimo && body.subtotal < minimo) {
      const formateado = Math.round(minimo).toLocaleString('es-AR');
      throw Errors.badRequest('Ese cupón aplica para compras desde $' + formateado, {
        minimoCompra: minimo,
      });
    }
    const valor = dec(cupon.valor) ?? 0;
    const descuento =
      cupon.tipo === 'PORCENTAJE'
        ? Math.round((body.subtotal * valor) / 100)
        : Math.min(valor, body.subtotal);
    return {
      valido: true,
      cupon: {
        codigo: cupon.codigo,
        descripcion: cupon.descripcion,
        tipo: cupon.tipo,
        valor,
        minimoCompra: minimo,
        acumulable: cupon.acumulable,
      },
      descuento,
    };
  });

  // ------------------------------------------------------------------
  // Newsletter / avisos de stock / contacto
  // ------------------------------------------------------------------
  app.post('/newsletter', formRateLimit, async (request, reply) => {
    const body = parse(newsletterAltaInput, request.body);
    // Prompt 6: guarda el nombre, reactiva si tenía baja y confirma por email (con link de baja) sólo en altas nuevas o reactivaciones.
    const previa = await prisma.suscripcionNewsletter.findUnique({ where: { email: body.email } });
    const s = await prisma.suscripcionNewsletter.upsert({
      where: { email: body.email },
      update: { bajaEn: null, ...(body.nombre ? { nombre: body.nombre } : {}) },
      create: { email: body.email, nombre: body.nombre ?? null, origen: body.origen ?? 'web' },
    });
    if (!previa || previa.bajaEn !== null) {
      const web = app.env.WEB_URL.replace(/\/$/, '');
      await enviarPlantilla(app.env, {
        tipo: 'NEWSLETTER_ALTA',
        para: s.email,
        vars: { nombre: s.nombre ?? '', url: `${web}/`, urlBaja: `${web}/newsletter/baja/${s.token}` },
        ctaHref: `${web}/`,
        urlBaja: `${web}/newsletter/baja/${s.token}`,
      });
    }
    return reply.status(201).send({ ok: true });
  });

  app.post('/avisos-stock', formRateLimit, async (request, reply) => {
    const body = parse(avisoStockInput, request.body);
    const variante = await prisma.variante.findFirst({
      where: { id: body.varianteId, activa: true, producto: { ...EN_TIENDA } },
      select: { id: true },
    });
    if (!variante) throw Errors.notFound('La variante no existe');
    await prisma.avisoStock.upsert({
      where: { email_varianteId: { email: body.email, varianteId: variante.id } },
      update: { notificadoEn: null },
      create: { email: body.email, varianteId: variante.id },
    });
    return reply.status(201).send({ ok: true });
  });

  app.post('/contacto', formRateLimit, async (request, reply) => {
    const body = parse(contactoInput, request.body);
    // Honeypot: los bots completan el campo oculto; respondemos ok sin guardar.
    if (body.web) return reply.status(201).send({ ok: true });
    const { web: _w, ...data } = body;
    const m = await prisma.mensajeContacto.create({ data });
    return reply.status(201).send({ ok: true, id: m.id });
  });
};

export default catalogoRoutes;
