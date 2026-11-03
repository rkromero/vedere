// Filtros del listado: se leen y escriben en la URL (compartibles) y se traducen a la query de la API.
import { LABELS } from '@/lib/format';
import type { Forma, Genero, Linea, Material } from '@/lib/format';

export type SearchParams = Record<string, string | string[] | undefined>;

export const ORDENES = [
  { value: 'relevancia', label: 'Más relevantes' },
  { value: 'novedades', label: 'Novedades' },
  { value: 'mas_vendidos', label: 'Más vendidos' },
  { value: 'precio_asc', label: 'Menor precio' },
  { value: 'precio_desc', label: 'Mayor precio' },
] as const;
export type Orden = (typeof ORDENES)[number]['value'];

export const PAGE_SIZE = 24;

/** Claves de filtro que viven en la URL del listado. */
export const FILTER_KEYS = ['forma', 'color', 'material', 'linea', 'genero', 'precioMin', 'precioMax'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export interface FiltrosActivos {
  forma: Forma[];
  color: string[];
  material: Material[];
  linea: Linea[];
  genero: Genero[];
  precioMin: number | null;
  precioMax: number | null;
  orden: Orden;
  page: number;
  q: string;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const list = (v: string | string[] | undefined) =>
  first(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const enumList = <T extends string>(v: string | string[] | undefined, labels: Record<T, string>) =>
  list(v)
    .map((s) => s.toUpperCase())
    .filter((s): s is T => s in labels);

export function parseFiltros(sp: SearchParams): FiltrosActivos {
  const num = (v: string) => (v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const orden = first(sp.orden);
  const page = Number(first(sp.page));
  return {
    forma: enumList<Forma>(sp.forma, LABELS.forma),
    color: list(sp.color),
    material: enumList<Material>(sp.material, LABELS.material),
    linea: enumList<Linea>(sp.linea, LABELS.linea),
    genero: enumList<Genero>(sp.genero, LABELS.genero),
    precioMin: num(first(sp.precioMin)),
    precioMax: num(first(sp.precioMax)),
    orden: (ORDENES.some((o) => o.value === orden) ? orden : 'relevancia') as Orden,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    q: first(sp.q).slice(0, 120),
  };
}

/** Contexto fijo del listado (línea, colección, categoría o búsqueda) que no es filtro editable. */
export interface ContextoListado {
  linea?: Linea;
  coleccion?: string;
  categoria?: string;
  q?: string;
  destacado?: boolean;
  orden?: Orden;
}

/** Query string para /catalogo/productos. */
export function apiQuery(f: FiltrosActivos, ctx: ContextoListado, page = f.page): string {
  const sp = new URLSearchParams();
  sp.set('page', String(page));
  sp.set('pageSize', String(PAGE_SIZE));
  sp.set('orden', ctx.orden ?? f.orden);
  if (ctx.linea) sp.set('linea', ctx.linea);
  else if (f.linea.length) sp.set('linea', f.linea.join(','));
  if (ctx.coleccion) sp.set('coleccion', ctx.coleccion);
  if (ctx.categoria) sp.set('categoria', ctx.categoria);
  if (ctx.destacado) sp.set('destacado', 'true');
  const q = ctx.q ?? f.q;
  if (q) sp.set('q', q);
  if (f.forma.length) sp.set('forma', f.forma.join(','));
  if (f.color.length) sp.set('color', f.color.join(','));
  if (f.material.length) sp.set('material', f.material.join(','));
  if (f.genero.length) sp.set('genero', f.genero.join(','));
  if (f.precioMin !== null) sp.set('precioMin', String(f.precioMin));
  if (f.precioMax !== null) sp.set('precioMax', String(f.precioMax));
  return `?${sp.toString()}`;
}

/** Query string de la URL de la página (sólo lo que el usuario eligió). */
export function urlQuery(f: Partial<FiltrosActivos>, extra: Record<string, string> = {}): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set('q', f.q);
  if (f.forma?.length) sp.set('forma', f.forma.join(','));
  if (f.color?.length) sp.set('color', f.color.join(','));
  if (f.material?.length) sp.set('material', f.material.join(','));
  if (f.linea?.length) sp.set('linea', f.linea.join(','));
  if (f.genero?.length) sp.set('genero', f.genero.join(','));
  if (f.precioMin !== null && f.precioMin !== undefined) sp.set('precioMin', String(f.precioMin));
  if (f.precioMax !== null && f.precioMax !== undefined) sp.set('precioMax', String(f.precioMax));
  if (f.orden && f.orden !== 'relevancia') sp.set('orden', f.orden);
  if (f.page && f.page > 1) sp.set('page', String(f.page));
  for (const [k, v] of Object.entries(extra)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface ChipActivo {
  key: FilterKey;
  value: string;
  label: string;
}

/** Chips de filtros activos con etiqueta legible. */
export function chipsActivos(f: FiltrosActivos, mostrarLinea = true): ChipActivo[] {
  const chips: ChipActivo[] = [];
  for (const v of f.forma) chips.push({ key: 'forma', value: v, label: LABELS.forma[v] });
  for (const v of f.color) chips.push({ key: 'color', value: v, label: v });
  for (const v of f.material) chips.push({ key: 'material', value: v, label: LABELS.material[v] });
  if (mostrarLinea)
    for (const v of f.linea) chips.push({ key: 'linea', value: v, label: LABELS.linea[v] });
  for (const v of f.genero) chips.push({ key: 'genero', value: v, label: LABELS.genero[v] });
  if (f.precioMin !== null)
    chips.push({ key: 'precioMin', value: String(f.precioMin), label: `Desde $${f.precioMin.toLocaleString('es-AR')}` });
  if (f.precioMax !== null)
    chips.push({ key: 'precioMax', value: String(f.precioMax), label: `Hasta $${f.precioMax.toLocaleString('es-AR')}` });
  return chips;
}

export function hayFiltros(f: FiltrosActivos, mostrarLinea = true): boolean {
  return chipsActivos(f, mostrarLinea).length > 0;
}

/** Quita un valor de un filtro y devuelve los filtros resultantes. */
export function sinFiltro(f: FiltrosActivos, chip: ChipActivo): FiltrosActivos {
  const next: FiltrosActivos = { ...f, page: 1 };
  switch (chip.key) {
    case 'forma':
      next.forma = f.forma.filter((v) => v !== chip.value);
      break;
    case 'color':
      next.color = f.color.filter((v) => v !== chip.value);
      break;
    case 'material':
      next.material = f.material.filter((v) => v !== chip.value);
      break;
    case 'linea':
      next.linea = f.linea.filter((v) => v !== chip.value);
      break;
    case 'genero':
      next.genero = f.genero.filter((v) => v !== chip.value);
      break;
    case 'precioMin':
      next.precioMin = null;
      break;
    case 'precioMax':
      next.precioMax = null;
      break;
  }
  return next;
}

export function limpiarFiltros(f: FiltrosActivos): FiltrosActivos {
  return {
    ...f,
    forma: [],
    color: [],
    material: [],
    linea: [],
    genero: [],
    precioMin: null,
    precioMax: null,
    page: 1,
  };
}
