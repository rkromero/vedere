// Carga por código de barras: búsqueda en la API, importación de fotos y volcado de la sugerencia al formulario.
import { api } from '@/lib/api-client';
import type { TipoImagen } from '@/lib/format';
import type { Imagen, Marca, ResultadoCodigo, SugerenciaProducto } from '@/lib/types';
import { nuevaVariante, slugify } from './form-types';
import type { ProductoFormState, VarianteForm } from './form-types';

export function buscarCodigo(codigo: string, externo = false) {
  return api.get<ResultadoCodigo>(
    `/admin/codigo-barras/${encodeURIComponent(codigo.trim())}${externo ? '?externo=1' : ''}`,
  );
}

const TIPOS_POR_POSICION: TipoImagen[] = ['FRENTE', 'PERFIL', 'TRES_CUARTOS', 'PUESTO'];

/** Descarga las fotos externas a nuestro almacenamiento (WebP en 3 tamaños). */
export async function importarFotos(
  urls: string[],
  alt: string,
  desde = 0,
): Promise<{ imagenes: Imagen[]; fallidas: number }> {
  if (urls.length === 0) return { imagenes: [], fallidas: 0 };
  const r = await api.post<{
    imagenes: Array<{ url: string; urlMediana: string; urlMiniatura: string }>;
    errores: Array<{ url: string; mensaje: string }>;
  }>('/admin/imagenes/importar', { urls: urls.slice(0, 8) });
  return {
    imagenes: r.imagenes.map((img, i) => ({
      tipo: TIPOS_POR_POSICION[desde + i] ?? 'OTRA',
      orden: desde + i,
      url: img.url,
      urlMediana: img.urlMediana,
      urlMiniatura: img.urlMiniatura,
      alt: alt.slice(0, 160) || null,
    })),
    fallidas: r.errores.length,
  };
}

/** Busca la marca en el catálogo y, si no existe, la crea. Devuelve la marca (o null si no hay marca sugerida). */
export async function asegurarMarca(
  sugerida: string | null,
  marcaId: string | null,
  marcas: Marca[],
): Promise<{ marca: Marca | null; creada: boolean }> {
  if (!sugerida) return { marca: null, creada: false };
  const porId = marcaId ? marcas.find((m) => m.id === marcaId) : undefined;
  if (porId) return { marca: porId, creada: false };
  const clave = slugify(sugerida);
  const local = marcas.find((m) => m.slug === clave || slugify(m.nombre) === clave);
  if (local) return { marca: local, creada: false };
  const nueva = await api.post<Marca>('/admin/marcas', { nombre: sugerida });
  return { marca: nueva, creada: true };
}

const vacio = (v: string) => v.trim() === '';

/** SKU legible a partir del modelo y el color ("RB3547N-DOR"); si no hay modelo, el código. */
export function skuSugerido(s: SugerenciaProducto | null, codigo: string): string {
  if (s?.modelo) {
    const color = (s.colorArmazon ?? '')
      .normalize('NFD')
      .replace(/[^A-Za-z]/g, '')
      .slice(0, 3);
    const base = [s.modelo, color].filter(Boolean).join('-');
    const sku = base.toUpperCase().replace(/[^A-Z0-9._-]/g, '');
    if (sku.length >= 2) return sku.slice(0, 60);
  }
  return codigo.toUpperCase().slice(0, 60);
}

/** Completa una variante con el código y la sugerencia, sin pisar lo que el usuario ya cargó. */
export function completarVariante(
  v: VarianteForm,
  codigo: string,
  s: SugerenciaProducto | null,
  imagenes: Imagen[],
): VarianteForm {
  return {
    ...v,
    codigoBarras: codigo,
    sku: vacio(v.sku) ? skuSugerido(s, codigo) : v.sku,
    colorArmazon: vacio(v.colorArmazon) ? (s?.colorArmazon ?? '') : v.colorArmazon,
    colorArmazonHex:
      vacio(v.colorArmazon) && s?.colorArmazonHex ? s.colorArmazonHex : v.colorArmazonHex,
    colorLente: vacio(v.colorLente) ? (s?.colorLente ?? '') : v.colorLente,
    colorLenteHex: vacio(v.colorLente) && s?.colorLenteHex ? s.colorLenteHex : v.colorLenteHex,
    stock: v.stock === '0' || vacio(v.stock) ? '1' : v.stock,
    imagenes: [...v.imagenes, ...imagenes],
  };
}

/**
 * Vuelca la sugerencia en los datos del producto (sólo campos vacíos o con su valor por defecto,
 * para no pisar lo que ya se cargó a mano).
 */
export function completarProducto(
  st: ProductoFormState,
  s: SugerenciaProducto,
  marcaId: string | null,
): ProductoFormState {
  const descripcion = vacio(st.descripcion)
    ? [s.descripcion, s.polarizado && !/polari/i.test(s.descripcion) ? 'Lentes polarizados.' : '']
        .filter(Boolean)
        .join('\n\n')
    : st.descripcion;
  const nombre = vacio(st.nombre) ? s.nombre : st.nombre;
  return {
    ...st,
    nombre,
    slug: st.slugManual ? st.slug : slugify(nombre),
    descripcion,
    marcaId: vacio(st.marcaId) && marcaId ? marcaId : st.marcaId,
    // Línea: el default del alta es SOL; sólo la cambiamos si la fuente es clara.
    linea: s.linea ?? st.linea,
    material: st.material || (s.material ?? ''),
    forma: st.forma || (s.forma ?? ''),
    genero: st.genero === 'UNISEX' && s.genero ? s.genero : st.genero,
    calibreMm: vacio(st.calibreMm) && s.calibreMm ? String(s.calibreMm) : st.calibreMm,
    puenteMm: vacio(st.puenteMm) && s.puenteMm ? String(s.puenteMm) : st.puenteMm,
    varillaMm: vacio(st.varillaMm) && s.varillaMm ? String(s.varillaMm) : st.varillaMm,
  };
}

/** La variante a completar: la indicada, o la primera vacía, o una nueva al final. */
export function varianteDestino(
  st: ProductoFormState,
  key?: string,
): { variantes: VarianteForm[]; key: string } {
  if (key && st.variantes.some((v) => v.key === key)) return { variantes: st.variantes, key };
  const libre = st.variantes.find(
    (v) => vacio(v.sku) && vacio(v.colorArmazon) && vacio(v.codigoBarras),
  );
  if (libre) return { variantes: st.variantes, key: libre.key };
  const nueva = nuevaVariante();
  return { variantes: [...st.variantes, nueva], key: nueva.key };
}
