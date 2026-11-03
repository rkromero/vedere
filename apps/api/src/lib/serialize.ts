// Conversión de registros Prisma a JSON de la API (Decimal → number).
import type { Prisma } from '@vedere/db';

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

export function dec(v: DecimalLike): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  return v.toNumber();
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
    permiteReceta: p.permiteReceta,
    destacado: p.destacado,
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

/** Versión pública (tienda): sin auditoría ni variantes inactivas. */
export function serializeProductoPublico(p: ProductoFull) {
  const full = serializeProducto({ ...p, variantes: p.variantes.filter((v) => v.activa) });
  const { createdById: _c, updatedById: _u, ...rest } = full;
  return {
    ...rest,
    variantes: rest.variantes.map(({ createdById: _a, updatedById: _b, ...v }) => v),
  };
}
