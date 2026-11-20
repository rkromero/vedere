// Identificación de un anteojo a partir de fotos (patilla, frente, etiqueta) con Claude:
//   1. Visión: lee lo grabado en la patilla (marca, modelo, código de color, medidas 52□18 140) y lo
//      que se ve (forma, material, colores) → salida estructurada.
//   2. Web (opcional): con marca + modelo busca la ficha del modelo en internet para completar
//      descripción, material, medidas faltantes y URLs de fotos.
// El resultado tiene la misma forma que la sugerencia por código de barras, así el backoffice lo vuelca igual.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import sharp from 'sharp';
import { z } from 'zod';
import type { Env } from '../env.js';
import { FORMAS, GENEROS, LINEAS, MATERIALES } from '../schemas/catalogo.js';
import { traducirColor } from './codigo-barras.js';
import type { SugerenciaProducto } from './codigo-barras.js';
import { AppError } from './errors.js';
import { processAndStoreImage } from './storage.js';
import type { ProcessedImage } from './storage.js';

const MODELO = 'claude-opus-5-5';
const BETAS = ['server-side-fallback-2026-07-01'];

// ---------------------------------------------------------------------------
// Paso 1: lectura de las fotos
// ---------------------------------------------------------------------------

const lecturaSchema = z.object({
  esAnteojo: z
    .boolean()
    .describe('true si las fotos muestran un anteojo, su patilla, estuche o etiqueta'),
  textoLeido: z
    .string()
    .describe(
      'Transcripción literal de todo el texto grabado o impreso que se ve, separado por " | "',
    ),
  marca: z.string().nullable(),
  modelo: z
    .string()
    .nullable()
    .describe('Código o nombre de modelo, p. ej. "RB3025", "VK 1234", "Kingston"'),
  nombreComercial: z
    .string()
    .nullable()
    .describe('Nombre comercial del modelo si se conoce, p. ej. "Aviator"'),
  codigoColor: z
    .string()
    .nullable()
    .describe('Código de color tal como está grabado, p. ej. "C2", "001/58", "col. 3010"'),
  colorArmazon: z
    .string()
    .nullable()
    .describe('Color del armazón en castellano rioplatense, p. ej. "Negro", "Carey"'),
  colorLente: z
    .string()
    .nullable()
    .describe('Color de la lente en castellano, null si no se ve o es transparente de receta'),
  calibreMm: z.number().int().nullable(),
  puenteMm: z.number().int().nullable(),
  varillaMm: z.number().int().nullable(),
  linea: z
    .enum(LINEAS)
    .nullable()
    .describe('SOL si tiene lentes de sol; RECETADO si es armazón para graduar'),
  forma: z.enum(FORMAS).nullable(),
  material: z.enum(MATERIALES).nullable(),
  genero: z.enum(GENEROS).nullable(),
  polarizado: z.boolean(),
  fotosDelProducto: z
    .array(z.number().int())
    .describe(
      'Números (1, 2, …) de las fotos que muestran el anteojo entero con buena calidad y sirven como foto de catálogo. No incluyas fotos de la patilla de cerca ni de etiquetas.',
    ),
  confianza: z.enum(['alta', 'media', 'baja']),
  notas: z.string().describe('Dudas o datos ilegibles, en una o dos frases. Vacío si no hay.'),
});

export type LecturaFoto = z.infer<typeof lecturaSchema>;

const PROMPT_LECTURA = `Sos el encargado de stock de una óptica argentina. Te paso fotos de un anteojo que hay que dar de alta en el catálogo: pueden ser de la cara interna de la patilla, del frente, del costado, de la etiqueta o del estuche.

Extraé todo lo que se pueda saber del anteojo:
- Leé con cuidado el texto grabado en la patilla. Suele traer marca, modelo, código de color y medidas en el formato calibre□puente largo-de-patilla (por ejemplo "52□18 140", "52-18-140" o "52 18 140"). También puede traer "CE", "Made in ...", "Hand made" o números de serie: transcribilos en textoLeido pero no los confundas con el modelo.
- Si reconocés la marca por el logo, usala aunque no esté escrita.
- Color, forma y material, de lo que se ve en las fotos.
- No inventes: si un dato no se ve o no se puede leer, dejalo en null y mencionalo en notas.`;

async function prepararParaClaude(buffer: Buffer): Promise<string> {
  // 1568 px de lado mayor: suficiente para leer grabados chicos sin mandar imágenes enormes.
  const jpg = await sharp(buffer)
    .rotate()
    .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  return jpg.toString('base64');
}

function cliente(env: Env): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(
      503,
      'IA_NO_CONFIGURADA',
      'La identificación por foto no está configurada (falta ANTHROPIC_API_KEY).',
    );
  }
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000 });
}

function errorDeClaude(err: unknown): never {
  if (err instanceof AppError) throw err;
  if (err instanceof Anthropic.AuthenticationError) {
    throw new AppError(503, 'IA_NO_CONFIGURADA', 'La clave de Anthropic no es válida.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    throw new AppError(429, 'IA_OCUPADA', 'La IA está saturada, probá de nuevo en un minuto.');
  }
  if (err instanceof Anthropic.APIError) {
    throw new AppError(
      502,
      'IA_ERROR',
      `La IA no pudo procesar las fotos (${err.status ?? 'sin respuesta'}).`,
    );
  }
  throw new AppError(502, 'IA_ERROR', 'La IA no pudo procesar las fotos.');
}

export async function leerFotos(client: Anthropic, fotosB64: string[]): Promise<LecturaFoto> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  fotosB64.forEach((data, i) => {
    content.push({ type: 'text', text: `Foto ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
  });
  content.push({ type: 'text', text: PROMPT_LECTURA });

  const res = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(lecturaSchema) },
    messages: [{ role: 'user', content }],
  });
  if (res.stop_reason === 'refusal') {
    throw new AppError(422, 'IA_RECHAZO', 'La IA no pudo analizar estas fotos. Probá con otras.');
  }
  if (!res.parsed_output) {
    throw new AppError(502, 'IA_ERROR', 'La IA devolvió una respuesta incompleta. Probá de nuevo.');
  }
  return res.parsed_output;
}

// ---------------------------------------------------------------------------
// Paso 2: ficha del modelo en internet
// ---------------------------------------------------------------------------

const fichaSchema = z.object({
  encontrado: z.boolean(),
  nombre: z.string().nullable(),
  descripcion: z.string().nullable(),
  linea: z.enum(LINEAS).nullable(),
  forma: z.enum(FORMAS).nullable(),
  material: z.enum(MATERIALES).nullable(),
  genero: z.enum(GENEROS).nullable(),
  calibreMm: z.number().int().nullable(),
  puenteMm: z.number().int().nullable(),
  varillaMm: z.number().int().nullable(),
  colorArmazon: z.string().nullable(),
  colorLente: z.string().nullable(),
  polarizado: z.boolean().nullable(),
  imagenes: z.array(z.string()),
});
type Ficha = z.infer<typeof fichaSchema>;

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({
  type: [type, 'null'],
  ...extra,
});
const enumNullable = (values: readonly string[]) => ({
  anyOf: [{ type: 'string', enum: [...values] }, { type: 'null' }],
});

const TOOL_FICHA: Anthropic.Beta.BetaTool = {
  name: 'guardar_ficha',
  description:
    'Guarda la ficha del modelo encontrada en internet. Llamala una sola vez, al final, aunque no hayas encontrado nada (encontrado: false).',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(fichaSchema.shape),
    properties: {
      encontrado: { type: 'boolean', description: 'true sólo si encontraste el modelo exacto' },
      nombre: nullable('string', {
        description: 'Nombre para la tienda: marca + modelo + nombre comercial',
      }),
      descripcion: nullable('string', {
        description:
          'Descripción para la tienda en castellano rioplatense, 2 a 4 oraciones, sólo con datos verificados',
      }),
      linea: enumNullable(LINEAS),
      forma: enumNullable(FORMAS),
      material: enumNullable(MATERIALES),
      genero: enumNullable(GENEROS),
      calibreMm: nullable('integer'),
      puenteMm: nullable('integer'),
      varillaMm: nullable('integer'),
      colorArmazon: nullable('string', { description: 'En castellano' }),
      colorLente: nullable('string', { description: 'En castellano' }),
      polarizado: nullable('boolean'),
      imagenes: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Hasta 6 URLs directas de imágenes (jpg, png o webp) de este modelo y color, copiadas de las páginas que viste. Nunca armes URLs a mano.',
      },
    },
  },
};

export async function buscarFichaWeb(client: Anthropic, l: LecturaFoto): Promise<Ficha | null> {
  if (!l.marca || !l.modelo) return null;
  const datos = [
    `Marca: ${l.marca}`,
    `Modelo: ${l.modelo}`,
    l.nombreComercial && `Nombre comercial: ${l.nombreComercial}`,
    l.codigoColor && `Código de color: ${l.codigoColor}`,
    l.colorArmazon && `Color de armazón: ${l.colorArmazon}`,
    l.calibreMm && `Calibre: ${l.calibreMm} mm`,
    `Texto de la patilla: ${l.textoLeido}`,
  ]
    .filter(Boolean)
    .join('\n');

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Buscá en internet la ficha de este anteojo (web oficial de la marca, distribuidores u ópticas) y guardala con guardar_ficha.

${datos}

Priorizá el modelo y color exactos. Si sólo encontrás el modelo en otro color, usá los datos del modelo (forma, material, medidas, descripción) pero no sus fotos. Si no encontrás el modelo, llamá a guardar_ficha con encontrado: false.`,
    },
  ];

  // Web search es una herramienta del servidor: puede cortar en pause_turn y hay que reenviar.
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const res = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }, TOOL_FICHA],
      tool_choice: { type: 'auto' },
      messages,
    });
    if (res.stop_reason === 'refusal') return null;
    const llamada = res.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock =>
        b.type === 'tool_use' && b.name === 'guardar_ficha',
    );
    if (llamada) {
      const ficha = fichaSchema.safeParse(llamada.input);
      return ficha.success && ficha.data.encontrado ? ficha.data : null;
    }
    if (res.stop_reason !== 'pause_turn') return null;
    messages.push({ role: 'assistant', content: res.content });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

export interface SugerenciaFoto extends SugerenciaProducto {
  textoLeido: string;
  codigoColor: string | null;
  confianza: 'alta' | 'media' | 'baja';
  notas: string;
  fichaWeb: boolean;
}

export interface ResultadoIdentificacion {
  sugerencia: SugerenciaFoto;
  /** Fotos subidas que sirven como imagen de catálogo, ya procesadas (WebP en 3 tamaños). */
  fotosPropias: ProcessedImage[];
}

export function combinar(l: LecturaFoto, f: Ficha | null): SugerenciaFoto {
  // Lo leído en la patilla manda (es el anteojo que está en la mano); la web completa lo que falta.
  const colorArmazon = l.colorArmazon ?? f?.colorArmazon ?? null;
  const colorLente = l.colorLente ?? f?.colorLente ?? null;
  const base = [l.marca, l.modelo, l.nombreComercial].filter(Boolean).join(' ');
  const nombre = (f?.nombre?.trim() || base || 'Anteojo sin identificar').slice(0, 160);
  const polarizado = l.polarizado || f?.polarizado === true;
  return {
    codigo: '',
    fuente: f ? 'Foto + web (IA)' : 'Foto (IA)',
    tituloOriginal: l.textoLeido,
    nombre,
    marca: l.marca,
    modelo: l.modelo,
    descripcion: (f?.descripcion ?? '').slice(0, 5000),
    linea: l.linea ?? f?.linea ?? null,
    forma: l.forma ?? f?.forma ?? null,
    material: l.material ?? f?.material ?? null,
    genero: l.genero ?? f?.genero ?? null,
    polarizado,
    calibreMm: l.calibreMm ?? f?.calibreMm ?? null,
    puenteMm: l.puenteMm ?? f?.puenteMm ?? null,
    varillaMm: l.varillaMm ?? f?.varillaMm ?? null,
    colorArmazon,
    colorArmazonHex: traducirColor(colorArmazon)?.hex ?? null,
    colorLente,
    colorLenteHex: traducirColor(colorLente)?.hex ?? null,
    imagenes: [...new Set((f?.imagenes ?? []).filter((u) => /^https?:\/\//i.test(u)))].slice(0, 6),
    textoLeido: l.textoLeido,
    codigoColor: l.codigoColor,
    confianza: l.confianza,
    notas: l.notas,
    fichaWeb: !!f,
  };
}

export async function identificarPorFotos(
  env: Env,
  fotos: Buffer[],
): Promise<ResultadoIdentificacion> {
  const client = cliente(env);
  let fotosB64: string[];
  try {
    fotosB64 = await Promise.all(fotos.map(prepararParaClaude));
  } catch {
    throw new AppError(400, 'BAD_REQUEST', 'Alguna de las fotos no es una imagen válida');
  }

  let lectura: LecturaFoto;
  try {
    lectura = await leerFotos(client, fotosB64);
  } catch (err) {
    errorDeClaude(err);
  }
  if (!lectura.esAnteojo) {
    throw new AppError(
      422,
      'NO_ES_ANTEOJO',
      'En las fotos no se ve un anteojo. Probá con otra foto.',
    );
  }

  let ficha: Ficha | null = null;
  if (env.IA_BUSQUEDA_WEB) {
    // La búsqueda web es un extra: si falla, seguimos con lo leído en la foto.
    ficha = await buscarFichaWeb(client, lectura).catch(() => null);
  }

  const indices = [...new Set(lectura.fotosDelProducto)].filter((n) => n >= 1 && n <= fotos.length);
  const fotosPropias = await Promise.all(
    indices.map((n) => processAndStoreImage(env, { buffer: fotos[n - 1]!, folder: 'productos' })),
  );

  return { sugerencia: combinar(lectura, ficha), fotosPropias };
}
