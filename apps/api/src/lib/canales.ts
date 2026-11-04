// Canales de venta: tienda web (público) y mayorista (ópticas socias). Un producto se ve en la tienda sólo si
// está PUBLICADO y visibleTienda; en el canal mayorista, si está PUBLICADO y visibleMayorista.
import type { Prisma } from '@vedere/db';

/** Filtro de productos visibles en la tienda pública (catálogo, ficha, buscador, sitemap, feeds). */
export const EN_TIENDA = { estado: 'PUBLICADO', visibleTienda: true } as const satisfies Prisma.ProductoWhereInput;

/** Filtro de productos visibles en el canal mayorista. */
export const EN_MAYORISTA = { estado: 'PUBLICADO', visibleMayorista: true } as const satisfies Prisma.ProductoWhereInput;
