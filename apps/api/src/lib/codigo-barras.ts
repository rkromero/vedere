// Códigos de barras (EAN / UPC / GTIN): normalización, búsqueda de datos del anteojo en bases públicas
// y conversión a una sugerencia de producto para el backoffice.
//
// Fuentes, en orden (gana la primera que encuentra el código):
//   1. Barcode Lookup  (si hay BARCODELOOKUP_API_KEY; pago, la mejor cobertura)
//   2. UPCitemdb       (plan pago con UPCITEMDB_USER_KEY o el plan trial gratis: ~100 consultas/día)
//   3. Open Product Facts (gratis, cobertura baja en óptica)
import type { Env } from '../env.js';
import type { FORMAS, GENEROS, LINEAS, MATERIALES } from '../schemas/catalogo.js';

type Linea = (typeof LINEAS)[number];
type Forma = (typeof FORMAS)[number];
type Genero = (typeof GENEROS)[number];
type Material = (typeof MATERIALES)[number];

export interface SugerenciaProducto {
  codigo: string;
  fuente: string;
  /** Título tal cual vino de la fuente (para referencia). */
  tituloOriginal: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  descripcion: string;
  linea: Linea | null;
  forma: Forma | null;
  material: Material | null;
  genero: Genero | null;
  polarizado: boolean;
  calibreMm: number | null;
  puenteMm: number | null;
  varillaMm: number | null;
  colorArmazon: string | null;
  colorArmazonHex: string | null;
  colorLente: string | null;
  colorLenteHex: string | null;
  /** URLs externas de fotos (se importan aparte con POST /admin/imagenes/importar). */
  imagenes: string[];
}

/** Datos crudos comunes a todas las fuentes. */
export interface DatosCrudos {
  fuente: string;
  titulos: string[];
  descripcion: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  talle: string | null;
  categoria: string | null;
  imagenes: string[];
}

// ---------------------------------------------------------------------------
// Normalización y validación
// ---------------------------------------------------------------------------

/** Dígito verificador GS1 (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function gtinValido(codigo: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(codigo)) return false;
  const digitos = codigo.split('').map(Number);
  const verificador = digitos.pop()!;
  const suma = digitos.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === verificador;
}

/**
 * Limpia lo que manda el lector (espacios, guiones) y unifica UPC-A (12) a EAN-13 con un 0 adelante,
 * para que el mismo anteojo escaneado como UPC o como EAN dé el mismo código.
 * Acepta también códigos internos alfanuméricos (Code 128) de 4 a 32 caracteres.
 */
export function normalizarCodigo(raw: string): string | null {
  const limpio = raw.trim().replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z0-9._]{4,32}$/.test(limpio)) return null;
  if (/^\d{12}$/.test(limpio) && gtinValido(limpio)) return `0${limpio}`;
  return limpio;
}

/** Variantes del mismo código para buscar en la base (EAN-13 con 0 ⇄ UPC-A). */
export function formasEquivalentes(codigo: string): string[] {
  const out = new Set([codigo]);
  if (/^0\d{12}$/.test(codigo)) out.add(codigo.slice(1));
  if (/^\d{12}$/.test(codigo)) out.add(`0${codigo}`);
  return [...out];
}

/** Sólo los GTIN válidos se consultan afuera (un código interno no va a estar en ninguna base). */
export function consultableAfuera(codigo: string): boolean {
  return gtinValido(codigo);
}

// ---------------------------------------------------------------------------
// Interpretación del texto (inglés / español) a campos del catálogo
// ---------------------------------------------------------------------------

const COLORES: Array<[RegExp, string, string]> = [
  [/\b(matte\s+black|negro\s+mate)\b/i, 'Negro mate', '#1f1f1f'],
  [/\b(black|negro|nero|noir)\b/i, 'Negro', '#0a0a0a'],
  [/\b(havana|tortoise|tortoiseshell|carey)\b/i, 'Carey', '#6b3e1f'],
  [/\b(gold|golden|dorado|oro)\b/i, 'Dorado', '#c9a227'],
  [/\b(silver|plateado|plata|gunmetal)\b/i, 'Plateado', '#a8a9ad'],
  [/\b(rose\s+gold|oro\s+rosa)\b/i, 'Oro rosa', '#b76e79'],
  [/\b(transparent|crystal|clear|cristal|transparente)\b/i, 'Transparente', '#e8e8e8'],
  [/\b(white|blanco)\b/i, 'Blanco', '#f5f5f5'],
  [/\b(brown|marr[oó]n|bronze|bronce)\b/i, 'Marrón', '#5c3a21'],
  [/\b(grey|gray|gris|smoke)\b/i, 'Gris', '#6b6b6b'],
  [/\b(green|verde|g-?15)\b/i, 'Verde', '#3f5f3a'],
  [/\b(blue|azul|navy)\b/i, 'Azul', '#1f3f7a'],
  [/\b(red|rojo|bordeaux|burgundy|bord[oó])\b/i, 'Rojo', '#8b1e1e'],
  [/\b(pink|rosa)\b/i, 'Rosa', '#e7a1b0'],
  [/\b(purple|violet|violeta|lila)\b/i, 'Violeta', '#6b3fa0'],
  [/\b(yellow|amarillo)\b/i, 'Amarillo', '#e6c229'],
  [/\b(orange|naranja)\b/i, 'Naranja', '#e07a1f'],
];

/** Traduce un color ("Black", "Gold") a nombre en castellano + hex aproximado. */
export function traducirColor(
  texto: string | null | undefined,
): { nombre: string; hex: string } | null {
  if (!texto) return null;
  for (const [re, nombre, hex] of COLORES) if (re.test(texto)) return { nombre, hex };
  return null;
}

function detectarLinea(t: string): Linea | null {
  if (
    /\b(sunglass(es)?|sun\s*glasses|anteojos?\s+de\s+sol|lentes?\s+de\s+sol|polari[sz]ed|polarizad[oa]s?)\b/i.test(
      t,
    )
  )
    return 'SOL';
  if (/\b(progressive|multifocal)\b/i.test(t)) return 'MULTIFOCAL';
  if (/\b(eyeglass(es)?|optical|frames?|rx|prescription|receta|armaz[oó]n|monturas?)\b/i.test(t))
    return 'RECETADO';
  if (/\b(case|estuche|cord[oó]n|chain|cleaning|pa[nñ]o)\b/i.test(t)) return 'ACCESORIO';
  return null;
}

function detectarForma(t: string): Forma | null {
  if (/\b(aviator|pilot|aviador)\b/i.test(t)) return 'AVIADOR';
  if (/\b(cat[\s-]?eye|ojo\s+de\s+gato)\b/i.test(t)) return 'OJO_DE_GATO';
  if (/\b(round|oval|redond[oa]|ovalad[oa]|panto)\b/i.test(t)) return 'REDONDO';
  if (/\b(rectang(le|ular)|rectangular)\b/i.test(t)) return 'RECTANGULAR';
  if (/\b(square|cuadrad[oa]|wayfarer|clubmaster|browline)\b/i.test(t)) return 'CUADRADO';
  return null;
}

function detectarMaterial(t: string): Material | null {
  if (/\btitan(ium|io)\b/i.test(t)) return 'TITANIO';
  if (/\btr[\s-]?90\b/i.test(t)) return 'TR90';
  if (/\b(acetate|acetato)\b/i.test(t) && /\b(metal|steel)\b/i.test(t)) return 'MIXTO';
  if (/\b(acetate|acetato)\b/i.test(t)) return 'ACETATO';
  if (/\b(metal|steel|acero)\b/i.test(t)) return 'METAL';
  return null;
}

function detectarGenero(t: string): Genero | null {
  const mujer = /\b(women'?s?|woman|ladies|female|mujer|dama)\b/i.test(t);
  const hombre = /\b(men'?s|man|male|hombre|caballero)\b/i.test(t.replace(/\bwo(men|man)/gi, ''));
  if (/\bunisex\b/i.test(t) || (mujer && hombre)) return 'UNISEX';
  if (mujer) return 'MUJER';
  if (hombre) return 'HOMBRE';
  return null;
}

/**
 * Medidas en el formato habitual de los armazones: "50-22-145", "50□22 145", "52/18 140",
 * "Size 48", "48mm". Devuelve calibre / puente / varilla dentro de rangos razonables.
 */
export function detectarMedidas(textos: string[]): {
  calibreMm: number | null;
  puenteMm: number | null;
  varillaMm: number | null;
} {
  const t = textos.join(' | ');
  const triple = /\b([3-6]\d)\s*(?:[-/x□]|\s)\s*(\d{2})\s*(?:[-/x□]|\s)\s*(1[2-5]\d)\b/.exec(t);
  if (triple) {
    return {
      calibreMm: Number(triple[1]),
      puenteMm: Number(triple[2]),
      varillaMm: Number(triple[3]),
    };
  }
  const doble = /\b([3-6]\d)\s*[□/]\s*([1-2]\d)\b/.exec(t);
  if (doble) return { calibreMm: Number(doble[1]), puenteMm: Number(doble[2]), varillaMm: null };
  const mm =
    /\b([3-6]\d)\s?mm\b/i.exec(t) ?? /\b(?:size|talle|calibre)\s*:?\s*([3-6]\d)\b/i.exec(t);
  if (mm) return { calibreMm: Number(mm[1]), puenteMm: null, varillaMm: null };
  // "RB3547N 48": número de 2 cifras pegado al final del título, después del modelo.
  const final = /[A-Z]{1,4}\d{3,5}[A-Z]?\s+([3-6]\d)\s*$/i.exec(textos[0] ?? '');
  if (final) return { calibreMm: Number(final[1]), puenteMm: null, varillaMm: null };
  return { calibreMm: null, puenteMm: null, varillaMm: null };
}

/** Código de modelo tipo "RB3547N", "PO3007V", "OO9208", "VE4361". */
export function detectarModelo(textos: string[]): string | null {
  for (const t of textos) {
    const m = /\b([A-Z]{1,4}\s?\d{3,5}[A-Z]{0,2})\b/.exec(t);
    if (m) return m[1]!.replace(/\s/g, '');
  }
  return null;
}

/** "Black/Green", "Gold / G-15 Green", "Negro - Gris": armazón y lente. */
function detectarColores(crudos: DatosCrudos) {
  const fuentes = [crudos.color, ...crudos.titulos].filter(Boolean) as string[];
  let armazon = traducirColor(crudos.color);
  let lente: { nombre: string; hex: string } | null = null;
  for (const t of fuentes) {
    const par = /([A-Za-zÀ-ÿ ]{3,30})\s*\/\s*([A-Za-zÀ-ÿ0-9 -]{3,30})/.exec(t);
    if (!par) continue;
    const a = traducirColor(par[1]);
    const l = traducirColor(par[2]);
    if (a && l) {
      armazon = armazon ?? a;
      lente = l;
      break;
    }
  }
  return { armazon, lente };
}

/** Respeta la grafía de la marca como aparece en el título ("Ray-ban" → "Ray-Ban"). */
function grafiaMarca(marca: string | null, titulos: string[]): string | null {
  if (!marca) return null;
  const limpia = marca.trim();
  const re = new RegExp(`\\b${limpia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  for (const t of titulos) {
    const m = re.exec(t);
    if (m && m[0] !== m[0].toLowerCase()) return m[0];
  }
  return limpia.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

const RUIDO = [
  /\b(sunglass(es)?|eyeglass(es)?|eyewear|glasses|frames?|optical)\b/gi,
  /\b(new|nuevo|authentic|original box|with case|free shipping)\b/gi,
  /\b(men'?s|women'?s|unisex|ladies)\b/gi,
  /\b[3-6]\d\s?mm\b/gi,
];

/** Nombre corto para la ficha: marca + modelo + nombre comercial, sin ruido de marketplace. */
function armarNombre(titulo: string, marca: string | null, modelo: string | null): string {
  let n = titulo.split(/[,|(]/)[0] ?? titulo;
  for (const re of RUIDO) n = n.replace(re, ' ');
  n = n.replace(/\b\d{3}\/\w{2,3}\b/g, ' '); // código de color "001/9O"
  n = n.replace(/\s+[3-6]\d\s*$/, ''); // calibre al final
  n = n.replace(/\s{2,}/g, ' ').trim();
  if (marca && !n.toLowerCase().includes(marca.toLowerCase())) n = `${marca} ${n}`;
  if (modelo && !n.toUpperCase().includes(modelo.toUpperCase())) n = `${n} ${modelo}`;
  return (
    n.trim().slice(0, 160) || [marca, modelo].filter(Boolean).join(' ') || titulo.slice(0, 160)
  );
}

/** Elige el título más informativo (el que menciona el modelo y no es una URL). */
function mejorTitulo(titulos: string[], modelo: string | null): string {
  const candidatos = titulos.filter((t) => t && !/^https?:/i.test(t));
  if (modelo) {
    const conModelo = candidatos.filter((t) => t.toUpperCase().includes(modelo));
    // Entre los que nombran el modelo, el más corto suele ser el más limpio.
    if (conModelo.length) return conModelo.sort((a, b) => a.length - b.length)[0]!;
  }
  return candidatos[0] ?? '';
}

export function interpretar(codigo: string, crudos: DatosCrudos): SugerenciaProducto {
  const textos = [
    ...crudos.titulos,
    crudos.descripcion,
    crudos.categoria ?? '',
    crudos.talle ?? '',
  ];
  const todo = textos.join(' \n ');
  const modelo =
    (crudos.modelo && !/^\d+$/.test(crudos.modelo) ? crudos.modelo : null) ??
    detectarModelo(crudos.titulos);
  const marca = grafiaMarca(crudos.marca, crudos.titulos);
  const titulo = mejorTitulo(crudos.titulos, modelo);
  const medidas = detectarMedidas([
    titulo,
    ...crudos.titulos,
    crudos.talle ?? '',
    crudos.descripcion,
  ]);
  const { armazon, lente } = detectarColores(crudos);
  const polarizado = /\bpolari[sz](ed|ados?|adas?)\b/i.test(todo);

  return {
    codigo,
    fuente: crudos.fuente,
    tituloOriginal: crudos.titulos[0] ?? '',
    nombre: armarNombre(titulo, marca, modelo),
    marca,
    modelo,
    descripcion: crudos.descripcion.trim().slice(0, 5000),
    linea: detectarLinea(todo),
    forma: detectarForma(todo),
    material: detectarMaterial(todo),
    genero: detectarGenero(todo),
    polarizado,
    ...medidas,
    colorArmazon: armazon?.nombre ?? (crudos.color?.trim() || null),
    colorArmazonHex: armazon?.hex ?? null,
    colorLente: lente?.nombre ?? null,
    colorLenteHex: lente?.hex ?? null,
    imagenes: [...new Set(crudos.imagenes.filter((u) => /^https?:\/\//i.test(u)))].slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Fuentes externas
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 8000;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'vedere-backoffice/1.0', ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (res.status === 429) throw new LimiteFuente();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

class LimiteFuente extends Error {
  constructor() {
    super('Se alcanzó el límite de consultas de la fuente');
  }
}

type Fuente = { nombre: string; buscar: (codigo: string) => Promise<DatosCrudos | null> };

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

function barcodeLookup(apiKey: string): Fuente {
  return {
    nombre: 'Barcode Lookup',
    async buscar(codigo) {
      const data = (await getJson(
        `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(codigo)}&formatted=y&key=${encodeURIComponent(apiKey)}`,
      )) as { products?: Array<Record<string, unknown>> } | null;
      const p = data?.products?.[0];
      if (!p) return null;
      return {
        fuente: 'Barcode Lookup',
        titulos: [str(p.title)].filter(Boolean),
        descripcion: str(p.description),
        marca: strOrNull(p.brand) ?? strOrNull(p.manufacturer),
        modelo: strOrNull(p.model) ?? strOrNull(p.mpn),
        color: strOrNull(p.color),
        talle: strOrNull(p.size),
        categoria: strOrNull(p.category),
        imagenes: strArr(p.images),
      };
    },
  };
}

function upcItemDb(userKey?: string): Fuente {
  return {
    nombre: 'UPCitemdb',
    async buscar(codigo) {
      const url = userKey
        ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${encodeURIComponent(codigo)}`
        : `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(codigo)}`;
      const data = (await getJson(
        url,
        userKey ? { user_key: userKey, key_type: '3scale' } : {},
      )) as {
        items?: Array<Record<string, unknown>>;
      } | null;
      const item = data?.items?.[0];
      if (!item) return null;
      const ofertas = Array.isArray(item.offers)
        ? (item.offers as Array<Record<string, unknown>>)
        : [];
      return {
        fuente: 'UPCitemdb',
        titulos: [str(item.title), ...ofertas.map((o) => str(o.title))].filter(Boolean),
        descripcion: str(item.description),
        marca: strOrNull(item.brand),
        modelo: strOrNull(item.model),
        color: strOrNull(item.color),
        talle: strOrNull(item.size),
        categoria: strOrNull(item.category),
        imagenes: strArr(item.images),
      };
    },
  };
}

const openProductFacts: Fuente = {
  nombre: 'Open Product Facts',
  async buscar(codigo) {
    const data = (await getJson(
      `https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json`,
    )) as { status?: number; product?: Record<string, unknown> } | null;
    if (!data || data.status !== 1 || !data.product) return null;
    const p = data.product;
    const imagenes = [p.image_front_url, p.image_url].filter(
      (u): u is string => typeof u === 'string',
    );
    return {
      fuente: 'Open Product Facts',
      titulos: [str(p.product_name), str(p.generic_name)].filter(Boolean),
      descripcion: str(p.generic_name),
      marca: strOrNull(str(p.brands).split(',')[0]),
      modelo: null,
      color: null,
      talle: null,
      categoria: strOrNull(p.categories),
      imagenes,
    };
  },
};

export function fuentesConfiguradas(env: Env): Fuente[] {
  const fuentes: Fuente[] = [];
  if (env.BARCODELOOKUP_API_KEY) fuentes.push(barcodeLookup(env.BARCODELOOKUP_API_KEY));
  fuentes.push(upcItemDb(env.UPCITEMDB_USER_KEY));
  fuentes.push(openProductFacts);
  return fuentes;
}

// Caché en memoria: el plan gratis de UPCitemdb es chico y el mismo código se escanea muchas veces.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; valor: SugerenciaProducto | null }>();

export function limpiarCacheCodigos() {
  cache.clear();
}

export interface ResultadoBusquedaExterna {
  sugerencia: SugerenciaProducto | null;
  /** Avisos no fatales (una fuente caída o sin cupo). */
  avisos: string[];
}

export async function buscarCodigoExterno(
  env: Env,
  codigo: string,
): Promise<ResultadoBusquedaExterna> {
  if (!env.CODIGO_BARRAS_LOOKUP || !consultableAfuera(codigo))
    return { sugerencia: null, avisos: [] };

  const enCache = cache.get(codigo);
  if (enCache && Date.now() - enCache.at < CACHE_TTL_MS)
    return { sugerencia: enCache.valor, avisos: [] };

  const avisos: string[] = [];
  let huboError = false;
  for (const fuente of fuentesConfiguradas(env)) {
    try {
      const crudos = await fuente.buscar(codigo);
      if (crudos && (crudos.titulos.length || crudos.imagenes.length)) {
        const sugerencia = interpretar(codigo, crudos);
        guardarCache(codigo, sugerencia);
        return { sugerencia, avisos };
      }
    } catch (err) {
      huboError = true;
      avisos.push(
        err instanceof LimiteFuente
          ? `${fuente.nombre}: se alcanzó el límite diario de consultas gratis`
          : `${fuente.nombre}: no respondió`,
      );
    }
  }
  // Sólo cacheamos el "no encontrado" si todas las fuentes respondieron bien.
  if (!huboError) guardarCache(codigo, null);
  return { sugerencia: null, avisos };
}

function guardarCache(codigo: string, valor: SugerenciaProducto | null) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(codigo, { at: Date.now(), valor });
}
