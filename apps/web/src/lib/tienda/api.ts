// Acceso al catálogo público desde Server Components, con la caché de fetch de Next
// (revalidación por tiempo + tags para invalidar desde el admin más adelante).
import { site } from '@/config/site';
import type { Producto, Paged } from '@/lib/types';
import type { Coleccion, Filtros, Optica, PromoMensaje, Sugerencias } from './types';
import { CONFIG_FALLBACK } from './checkout';
import type { ConfigCheckout } from './checkout';

const REVALIDATE = 60;

interface Opts {
  revalidate?: number | false;
  tags?: string[];
}

export async function publicApi<T>(path: string, opts: Opts = {}): Promise<T> {
  const res = await fetch(`${site.apiServerUrl}${path}`, {
    next: { revalidate: opts.revalidate ?? REVALIDATE, tags: ['catalogo', ...(opts.tags ?? [])] },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code: string; message: string };
    } | null;
    throw new PublicApiError(res.status, body?.error?.message ?? res.statusText);
  }
  return (await res.json()) as T;
}

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Igual que publicApi pero devuelve el fallback si la API falla (bloques no críticos). */
export async function publicApiOr<T>(path: string, fallback: T, opts: Opts = {}): Promise<T> {
  try {
    return await publicApi<T>(path, opts);
  } catch {
    return fallback;
  }
}

const VACIO: Paged<Producto> = { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 };

/** Configuración comercial pública (medios de pago, cuotas por línea, envío). */
export const checkoutConfig = () =>
  publicApiOr<ConfigCheckout>('/checkout/config', CONFIG_FALLBACK, { tags: ['config'] });

export const catalogo = {
  productos: (query: string) =>
    publicApiOr<Paged<Producto>>(`/catalogo/productos${query}`, VACIO, { tags: ['productos'] }),
  producto: (slug: string) =>
    publicApi<Producto>(`/catalogo/productos/${encodeURIComponent(slug)}`, {
      tags: ['productos', `producto:${slug}`],
    }),
  relacionados: (slug: string) =>
    publicApiOr<{ items: Producto[] }>(
      `/catalogo/productos/${encodeURIComponent(slug)}/relacionados`,
      { items: [] },
      { tags: ['productos'] },
    ),
  colecciones: () =>
    publicApiOr<{ items: Coleccion[] }>('/catalogo/colecciones', { items: [] }, {
      tags: ['colecciones'],
    }),
  categorias: () =>
    publicApiOr<{ items: CategoriaNodo[] }>('/catalogo/categorias', { items: [] }, {
      tags: ['categorias'],
    }),
  filtros: () =>
    publicApiOr<Filtros>(
      '/catalogo/filtros',
      {
        formas: [],
        materiales: [],
        generos: [],
        lineas: [],
        colores: [],
        precio: { min: 0, max: 0 },
      },
      { tags: ['productos'] },
    ),
  promos: () =>
    publicApiOr<{ items: PromoMensaje[] }>('/catalogo/promos', { items: [] }, {
      revalidate: 60,
      tags: ['promos'],
    }),
  opticas: (query = '') =>
    publicApiOr<{ items: Optica[]; total: number }>(
      `/catalogo/opticas${query}`,
      { items: [], total: 0 },
      { revalidate: 300, tags: ['opticas'] },
    ),
  sugerencias: (q: string) =>
    publicApiOr<Sugerencias>(
      `/catalogo/sugerencias?q=${encodeURIComponent(q)}`,
      { productos: [], categorias: [], colecciones: [] },
      { revalidate: 30 },
    ),
};

export interface CategoriaNodo {
  id: string;
  nombre: string;
  slug: string;
  padreId: string | null;
  orden: number;
  productos: number;
  hijas?: CategoriaNodo[];
}
