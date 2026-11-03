// Esquemas Zod del catálogo (entrada de la API admin).
import { z } from 'zod';

export const LINEAS = ['SOL', 'RECETADO', 'MULTIFOCAL', 'ACCESORIO'] as const;
export const FORMAS = ['REDONDO', 'CUADRADO', 'OJO_DE_GATO', 'AVIADOR', 'RECTANGULAR'] as const;
export const GENEROS = ['UNISEX', 'MUJER', 'HOMBRE'] as const;
export const MATERIALES = ['ACETATO', 'METAL', 'TITANIO', 'TR90', 'MIXTO', 'OTRO'] as const;
export const ESTADOS = ['BORRADOR', 'PUBLICADO', 'ARCHIVADO'] as const;
export const TIPOS_IMAGEN = ['FRENTE', 'PERFIL', 'TRES_CUARTOS', 'PUESTO', 'OTRA'] as const;

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido (minúsculas, números y guiones)');

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido (#RRGGBB)');
const nullableStr = (max: number) => z.string().trim().max(max).nullable().optional();
const idSchema = z.string().min(1);

/**
 * Esquema de actualización parcial: todos los campos opcionales y SIN los `.default()` del alta.
 * (`.partial()` de Zod conserva los defaults, con lo que un PUT con un solo campo pisaría el resto.)
 */
type SinDefault<T> = T extends z.ZodDefault<infer I> ? I : T;
type ShapeUpdate<S extends z.ZodRawShape> = { [K in keyof S]: z.ZodOptional<SinDefault<S[K]>> };
export function partialSinDefaults<S extends z.ZodRawShape>(shape: S): z.ZodObject<ShapeUpdate<S>> {
  const out: Record<string, z.ZodTypeAny> = {};
  for (const [k, v] of Object.entries(shape)) {
    const inner =
      v instanceof z.ZodDefault ? (v.def.innerType as z.ZodTypeAny) : (v as z.ZodTypeAny);
    out[k] = inner.optional();
  }
  return z.object(out) as unknown as z.ZodObject<ShapeUpdate<S>>;
}

// ---------- Marca ----------
export const marcaInput = z.object({
  nombre: z.string().trim().min(2, 'Ingresá el nombre').max(80),
  slug: slugSchema.optional(),
  logoUrl: z.url().nullable().optional(),
  activa: z.boolean().default(true),
});
export const marcaUpdate = partialSinDefaults(marcaInput.shape);

// ---------- Categoría ----------
export const categoriaInput = z.object({
  nombre: z.string().trim().min(2, 'Ingresá el nombre').max(80),
  slug: slugSchema.optional(),
  padreId: idSchema.nullable().optional(),
  orden: z.number().int().min(0).default(0),
  activa: z.boolean().default(true),
});
export const categoriaUpdate = partialSinDefaults(categoriaInput.shape);

// ---------- Colección ----------
export const coleccionInput = z.object({
  nombre: z.string().trim().min(2, 'Ingresá el nombre').max(80),
  slug: slugSchema.optional(),
  colorHex: hexColor,
  bannerUrl: z.url().nullable().optional(),
  vigenciaDesde: z.coerce.date().nullable().optional(),
  vigenciaHasta: z.coerce.date().nullable().optional(),
  activa: z.boolean().default(true),
});
export const coleccionUpdate = partialSinDefaults(coleccionInput.shape);

// ---------- Imagen de variante ----------
export const imagenInput = z.object({
  url: z.url(),
  urlMediana: z.url().nullable().optional(),
  urlMiniatura: z.url().nullable().optional(),
  tipo: z.enum(TIPOS_IMAGEN).default('OTRA'),
  orden: z.number().int().min(0).default(0),
  alt: nullableStr(160),
});

// ---------- Variante ----------
export const varianteInput = z.object({
  colorArmazon: z.string().trim().min(1, 'Ingresá el color del armazón').max(60),
  colorArmazonHex: hexColor.nullable().optional(),
  colorLente: nullableStr(60),
  colorLenteHex: hexColor.nullable().optional(),
  sku: z
    .string()
    .trim()
    .min(2, 'Ingresá el SKU')
    .max(60)
    .regex(/^[A-Za-z0-9._-]+$/, 'SKU inválido (letras, números, . _ -)')
    .transform((s) => s.toUpperCase()),
  stock: z.number().int().min(0).default(0),
  stockMinimo: z.number().int().min(0).default(0),
  activa: z.boolean().default(true),
  orden: z.number().int().min(0).default(0),
  imagenes: z.array(imagenInput).default([]),
});
export const varianteUpdate = partialSinDefaults(varianteInput.shape);

// ---------- Producto ----------
export const productoBase = z.object({
  nombre: z.string().trim().min(2, 'Ingresá el nombre').max(160),
  slug: slugSchema.optional(),
  descripcion: z.string().max(5000).default(''),
  marcaId: idSchema.nullable().optional(),
  categoriaIds: z.array(idSchema).default([]),
  coleccionId: idSchema.nullable().optional(),
  linea: z.enum(LINEAS, { error: 'Línea inválida' }),
  material: z.enum(MATERIALES).nullable().optional(),
  forma: z.enum(FORMAS).nullable().optional(),
  genero: z.enum(GENEROS).default('UNISEX'),
  calibreMm: z.number().int().min(20).max(90).nullable().optional(),
  puenteMm: z.number().int().min(5).max(40).nullable().optional(),
  varillaMm: z.number().int().min(80).max(180).nullable().optional(),
  precio: z.number().nonnegative('El precio no puede ser negativo'),
  precioLista: z.number().nonnegative().nullable().optional(),
  permiteReceta: z.boolean().default(false),
  destacado: z.boolean().default(false),
  edicionLimitada: z.boolean().default(false),
  estado: z.enum(ESTADOS).default('BORRADOR'),
  seoTitle: nullableStr(70),
  seoDescription: nullableStr(160),
});

export const productoInput = productoBase.extend({
  variantes: z.array(varianteInput).default([]),
});
export const productoUpdate = partialSinDefaults(productoBase.shape);

export const productoBulk = z.object({
  ids: z.array(idSchema).min(1, 'Seleccioná al menos un producto'),
  accion: z.enum(['publicar', 'archivar', 'borrador', 'eliminar', 'destacar', 'no_destacar']),
});

export const imagenesReorder = z.object({
  imagenes: z.array(imagenInput.extend({ id: idSchema.optional() })),
});

// ---------- Filtros admin ----------
export const productoListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  estado: z.enum(ESTADOS).optional(),
  linea: z.enum(LINEAS).optional(),
  marcaId: idSchema.optional(),
  categoriaId: idSchema.optional(),
  coleccionId: idSchema.optional(),
  forma: z.enum(FORMAS).optional(),
  material: z.enum(MATERIALES).optional(),
  genero: z.enum(GENEROS).optional(),
  destacado: z.enum(['true', 'false']).optional(),
  bajoStock: z.enum(['true', 'false']).optional(),
  sort: z
    .enum(['reciente', 'nombre', 'precio_asc', 'precio_desc', 'vendidos', 'actualizado'])
    .default('actualizado'),
});

// ---------- Filtros públicos ----------
/** Lista separada por comas restringida a un enum ("REDONDO,AVIADOR"). */
const enumList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .trim()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values)).min(1).max(values.length));

const strList = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(max)).min(1).max(24));

export const catalogoQuery = z.object({
  q: z.string().trim().max(120).optional(),
  categoria: z.string().trim().optional(), // slug (incluye hijas)
  linea: enumList(LINEAS).optional(),
  forma: enumList(FORMAS).optional(),
  color: strList(60).optional(), // colores de armazón (contiene, insensible a mayúsculas)
  material: enumList(MATERIALES).optional(),
  genero: enumList(GENEROS).optional(),
  marca: z.string().trim().optional(), // slug
  coleccion: z.string().trim().optional(), // slug
  slugs: strList(120).optional(), // lista explícita (vistos recientemente)
  precioMin: z.coerce.number().nonnegative().optional(),
  precioMax: z.coerce.number().nonnegative().optional(),
  destacado: z.enum(['true', 'false']).optional(),
  receta: z.enum(['true', 'false']).optional(),
  orden: z
    .enum(['mas_vendidos', 'novedades', 'precio_asc', 'precio_desc', 'relevancia'])
    .default('novedades'),
});

// ---------- Usuarios (ADMIN) ----------
export const ROLES = ['ADMIN', 'OPERADOR', 'OPTICA', 'CLIENTE'] as const;

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

export const usuarioInput = z.object({
  email: z
    .string({ error: 'Email inválido' })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Email inválido' })),
  nombre: z.string().trim().min(2, 'Ingresá el nombre').max(120),
  telefono: nullableStr(30),
  rol: z.enum(ROLES).default('CLIENTE'),
  activo: z.boolean().default(true),
  /** Sólo rol OPTICA: óptica a la que pertenece el usuario. */
  opticaId: z.string().min(1).nullable().optional(),
  password: passwordSchema,
});
export const usuarioUpdate = partialSinDefaults(usuarioInput.omit({ password: true }).shape);
export const usuarioPassword = z.object({ password: passwordSchema });
export const usuarioListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  rol: z.enum(ROLES).optional(),
  activo: z.enum(['true', 'false']).optional(),
});
