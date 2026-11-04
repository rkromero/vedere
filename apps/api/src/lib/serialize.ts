// Conversión de registros Prisma a JSON de la API (Decimal → number).
import type { Prisma } from '@vedere/db';

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

export function dec(v: DecimalLike): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  return v.toNumber();
}

/** "Nuevo" durante los primeros 45 días desde la publicación. */
const DIAS_NUEVO = 45;
export function esNuevo(publicadoEn: Date | null): boolean {
  if (!publicadoEn) return false;
  return Date.now() - publicadoEn.getTime() < DIAS_NUEVO * 24 * 60 * 60 * 1000;
}

export const productoInclude = {
  marca: { select: { id: true, nombre: true, slug: true, logoUrl: true } },
  coleccion: { select: { id: true, nombre: true, slug: true, colorHex: true } },
  categorias: { select: { id: true, nombre: true, slug: true, padreId: true } },
  variantes: {
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    include: { imagenes: { orderBy: { orden: 'asc' } } },
  },
} satisfies Prisma.ProductoInclude;

export type ProductoFull = Prisma.ProductoGetPayload<{ include: typeof productoInclude }>;

export function serializeVariante(v: ProductoFull['variantes'][number]) {
  return {
    id: v.id,
    productoId: v.productoId,
    colorArmazon: v.colorArmazon,
    colorArmazonHex: v.colorArmazonHex,
    colorLente: v.colorLente,
    colorLenteHex: v.colorLenteHex,
    sku: v.sku,
    stock: v.stock,
    stockMinimo: v.stockMinimo,
    bajoStock: v.stock < v.stockMinimo,
    activa: v.activa,
    orden: v.orden,
    imagenes: v.imagenes.map((i) => ({
      id: i.id,
      tipo: i.tipo,
      orden: i.orden,
      url: i.url,
      urlMediana: i.urlMediana,
      urlMiniatura: i.urlMiniatura,
      alt: i.alt,
    })),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    createdById: v.createdById,
    updatedById: v.updatedById,
  };
}

export function serializeProducto(p: ProductoFull) {
  const variantes = p.variantes.map(serializeVariante);
  return {
    id: p.id,
    nombre: p.nombre,
    slug: p.slug,
    descripcion: p.descripcion,
    marca: p.marca,
    marcaId: p.marcaId,
    coleccion: p.coleccion,
    coleccionId: p.coleccionId,
    categorias: p.categorias,
    linea: p.linea,
    material: p.material,
    forma: p.forma,
    genero: p.genero,
    medidas: { calibreMm: p.calibreMm, puenteMm: p.puenteMm, varillaMm: p.varillaMm },
    precio: dec(p.precio) ?? 0,
    precioLista: dec(p.precioLista),
    precioMayorista: dec(p.precioMayorista),
    visibleTienda: p.visibleTienda,
    visibleMayorista: p.visibleMayorista,
    permiteReceta: p.permiteReceta,
    destacado: p.destacado,
    edicionLimitada: p.edicionLimitada,
    nuevo: esNuevo(p.publicadoEn),
    estado: p.estado,
    seo: { title: p.seoTitle, description: p.seoDescription },
    vendidos: p.vendidos,
    publicadoEn: p.publicadoEn,
    stockTotal: variantes.reduce((acc, v) => acc + v.stock, 0),
    variantes,
    imagenPrincipal:
      variantes.flatMap((v) => v.imagenes)[0]?.urlMediana ??
      variantes.flatMap((v) => v.imagenes)[0]?.url ??
      null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    createdById: p.createdById,
    updatedById: p.updatedById,
  };
}

/**
 * Versión pública (tienda): sin auditoría, sin variantes inactivas y sin datos del canal mayorista
 * (precioMayorista y visibilidad por canal nunca salen en una respuesta pública).
 */
export function serializeProductoPublico(p: ProductoFull) {
  const full = serializeProducto({ ...p, variantes: p.variantes.filter((v) => v.activa) });
  const {
    createdById: _c,
    updatedById: _u,
    precioMayorista: _pm,
    visibleTienda: _vt,
    visibleMayorista: _vm,
    ...rest
  } = full;
  return {
    ...rest,
    variantes: rest.variantes.map(({ createdById: _a, updatedById: _b, ...v }) => v),
  };
}
