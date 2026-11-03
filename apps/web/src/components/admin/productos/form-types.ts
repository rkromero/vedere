// Estado local del formulario de producto y conversión a payloads de la API.
import type { EstadoProducto, Forma, Genero, Linea, Material } from '@/lib/format';
import type { Imagen, Producto, Variante } from '@/lib/types';

export interface VarianteForm {
  id?: string;
  key: string;
  colorArmazon: string;
  colorArmazonHex: string;
  colorLente: string;
  colorLenteHex: string;
  sku: string;
  stock: string;
  stockMinimo: string;
  activa: boolean;
  imagenes: Imagen[];
}

export interface ProductoFormState {
  nombre: string;
  slug: string;
  slugManual: boolean;
  descripcion: string;
  marcaId: string;
  categoriaIds: string[];
  coleccionId: string;
  linea: Linea;
  material: Material | '';
  forma: Forma | '';
  genero: Genero;
  calibreMm: string;
  puenteMm: string;
  varillaMm: string;
  precio: string;
  precioLista: string;
  permiteReceta: boolean;
  destacado: boolean;
  edicionLimitada: boolean;
  estado: EstadoProducto;
  seoTitle: string;
  seoDescription: string;
  variantes: VarianteForm[];
}

let keySeq = 0;
export const nextKey = () => `v-${Date.now()}-${keySeq++}`;

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function nuevaVariante(): VarianteForm {
  return {
    key: nextKey(),
    colorArmazon: '',
    colorArmazonHex: '#0a0a0a',
    colorLente: '',
    colorLenteHex: '',
    sku: '',
    stock: '0',
    stockMinimo: '0',
    activa: true,
    imagenes: [],
  };
}

export function varianteToForm(v: Variante): VarianteForm {
  return {
    id: v.id,
    key: v.id,
    colorArmazon: v.colorArmazon,
    colorArmazonHex: v.colorArmazonHex ?? '',
    colorLente: v.colorLente ?? '',
    colorLenteHex: v.colorLenteHex ?? '',
    sku: v.sku,
    stock: String(v.stock),
    stockMinimo: String(v.stockMinimo),
    activa: v.activa,
    imagenes: v.imagenes.map((i) => ({ ...i })),
  };
}

export function estadoInicial(p?: Producto | null): ProductoFormState {
  if (!p) {
    return {
      nombre: '',
      slug: '',
      slugManual: false,
      descripcion: '',
      marcaId: '',
      categoriaIds: [],
      coleccionId: '',
      linea: 'SOL',
      material: '',
      forma: '',
      genero: 'UNISEX',
      calibreMm: '',
      puenteMm: '',
      varillaMm: '',
      precio: '',
      precioLista: '',
      permiteReceta: false,
      destacado: false,
      edicionLimitada: false,
      estado: 'BORRADOR',
      seoTitle: '',
      seoDescription: '',
      variantes: [nuevaVariante()],
    };
  }
  return {
    nombre: p.nombre,
    slug: p.slug,
    slugManual: true,
    descripcion: p.descripcion,
    marcaId: p.marcaId ?? '',
    categoriaIds: p.categorias.map((c) => c.id),
    coleccionId: p.coleccionId ?? '',
    linea: p.linea,
    material: p.material ?? '',
    forma: p.forma ?? '',
    genero: p.genero,
    calibreMm: p.medidas.calibreMm?.toString() ?? '',
    puenteMm: p.medidas.puenteMm?.toString() ?? '',
    varillaMm: p.medidas.varillaMm?.toString() ?? '',
    precio: String(p.precio),
    precioLista: p.precioLista?.toString() ?? '',
    permiteReceta: p.permiteReceta,
    destacado: p.destacado,
    edicionLimitada: p.edicionLimitada,
    estado: p.estado,
    seoTitle: p.seo.title ?? '',
    seoDescription: p.seo.description ?? '',
    variantes: p.variantes.map(varianteToForm),
  };
}

const intOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
const strOrNull = (v: string) => (v.trim() === '' ? null : v.trim());

export function productoPayload(s: ProductoFormState) {
  return {
    nombre: s.nombre.trim(),
    ...(s.slug.trim() ? { slug: s.slug.trim() } : {}),
    descripcion: s.descripcion,
    marcaId: strOrNull(s.marcaId),
    categoriaIds: s.categoriaIds,
    coleccionId: strOrNull(s.coleccionId),
    linea: s.linea,
    material: s.material || null,
    forma: s.forma || null,
    genero: s.genero,
    calibreMm: intOrNull(s.calibreMm),
    puenteMm: intOrNull(s.puenteMm),
    varillaMm: intOrNull(s.varillaMm),
    precio: Number(s.precio),
    precioLista: s.precioLista.trim() === '' ? null : Number(s.precioLista),
    permiteReceta: s.permiteReceta,
    destacado: s.destacado,
    edicionLimitada: s.edicionLimitada,
    estado: s.estado,
    seoTitle: strOrNull(s.seoTitle),
    seoDescription: strOrNull(s.seoDescription),
  };
}

export function variantePayload(v: VarianteForm, orden: number) {
  return {
    colorArmazon: v.colorArmazon.trim(),
    colorArmazonHex: strOrNull(v.colorArmazonHex),
    colorLente: strOrNull(v.colorLente),
    colorLenteHex: strOrNull(v.colorLenteHex),
    sku: v.sku.trim(),
    stock: Number(v.stock || 0),
    stockMinimo: Number(v.stockMinimo || 0),
    activa: v.activa,
    orden,
    imagenes: v.imagenes.map((img, j) => ({
      url: img.url,
      urlMediana: img.urlMediana ?? null,
      urlMiniatura: img.urlMiniatura ?? null,
      tipo: img.tipo,
      orden: j,
      alt: img.alt?.trim() ? img.alt.trim() : null,
    })),
  };
}

export function bajoStock(v: VarianteForm): boolean {
  return Number(v.stock || 0) < Number(v.stockMinimo || 0);
}
