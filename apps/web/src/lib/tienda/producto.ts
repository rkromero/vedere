// Helpers de producto compartidos por tarjetas, ficha y carrito.
import type { Producto, Variante } from '@/lib/types';

/** Variantes activas con stock primero; la primera disponible es la "por defecto". */
export function variantesOrdenadas(p: Producto): Variante[] {
  return [...p.variantes].sort((a, b) => a.orden - b.orden);
}

export function varianteInicial(p: Producto, preferidaId?: string | null): Variante | null {
  const vs = variantesOrdenadas(p);
  if (preferidaId) {
    const pref = vs.find((v) => v.id === preferidaId);
    if (pref) return pref;
  }
  return vs.find((v) => v.stock > 0) ?? vs[0] ?? null;
}

/** Imagen principal y secundaria (hover) de la tarjeta. */
export function imagenesTarjeta(p: Producto, variante?: Variante | null) {
  const v = variante ?? varianteInicial(p);
  const imgs = v?.imagenes ?? [];
  const conFallback = imgs.length ? imgs : p.variantes.flatMap((x) => x.imagenes);
  const principal = conFallback[0] ?? null;
  const segunda = conFallback[1] ?? null;
  return {
    principal: principal ? { src: principal.urlMediana ?? principal.url, alt: principal.alt } : null,
    segunda: segunda ? { src: segunda.urlMediana ?? segunda.url, alt: segunda.alt } : null,
  };
}

export function altProducto(p: Producto, variante?: Variante | null, alt?: string | null) {
  if (alt) return alt;
  return variante ? `${p.nombre} color ${variante.colorArmazon}` : p.nombre;
}

export function urlProducto(p: { slug: string }, variante?: { id: string } | null) {
  return variante ? `/p/${p.slug}?v=${variante.id}` : `/p/${p.slug}`;
}

/** Slug de la sección de una línea (/sol, /recetados…). */
export const LINEA_SLUG: Record<Producto['linea'], string> = {
  SOL: 'sol',
  RECETADO: 'recetados',
  MULTIFOCAL: 'multifocales',
  ACCESORIO: 'accesorios',
};
