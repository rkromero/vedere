// Esquemas Zod de la tienda pública (prompt 3): promos, ópticas, cupones, newsletter, avisos, contacto, carrito.
import { z } from 'zod';
import { csvList } from '../lib/pagination.js';
import { partialSinDefaults, slugSchema } from './catalogo.js';

const nullableStr = (max: number) => z.string().trim().max(max).nullable().optional();
const emailSchema = z
  .string({ error: 'Ingresá un email válido' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Ingresá un email válido' }));

// ---------- Promos (barra superior) ----------
export const promoInput = z.object({
  texto: z.string().trim().min(3, 'Ingresá el texto').max(140),
  link: nullableStr(300),
  orden: z.number().int().min(0).default(0),
  activo: z.boolean().default(true),
  vigenciaDesde: z.coerce.date().nullable().optional(),
  vigenciaHasta: z.coerce.date().nullable().optional(),
});
export const promoUpdate = partialSinDefaults(promoInput.shape);

// ---------- Ópticas socias ----------
export const opticaInput = z.object({
  nombre: z.string().trim().min(2, 'Ingresá el nombre').max(120),
  slug: slugSchema.optional(),
  direccion: z.string().trim().min(3, 'Ingresá la dirección').max(200),
  localidad: z.string().trim().min(2, 'Ingresá la localidad').max(80),
  provincia: z.string().trim().min(2, 'Ingresá la provincia').max(80),
  codigoPostal: z
    .string()
    .trim()
    .regex(/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/, 'Código postal inválido (ej. 1425 o C1425ABC)')
    .transform((v) => v.toUpperCase()),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  telefono: nullableStr(40),
  whatsapp: nullableStr(40),
  email: z.union([emailSchema, z.literal('')]).nullable().optional(),
  horarios: nullableStr(200),
  activa: z.boolean().default(true),
  orden: z.number().int().min(0).default(0),
});
export const opticaUpdate = partialSinDefaults(opticaInput.shape);

export const opticasQuery = z.object({
  cp: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, '').slice(0, 4) : undefined)),
  q: z.string().trim().max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------- Cupones ----------
export const TIPOS_CUPON = ['PORCENTAJE', 'MONTO'] as const;
export const cuponBase = z.object({
  codigo: z
    .string()
    .trim()
    .min(3, 'Ingresá el código')
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Código inválido (letras, números, - y _)')
    .transform((s) => s.toUpperCase()),
  descripcion: nullableStr(140),
  tipo: z.enum(TIPOS_CUPON, { error: 'Tipo inválido' }),
  valor: z.number().positive('El valor debe ser mayor a 0'),
  minimoCompra: z.number().nonnegative().nullable().optional(),
  usosMax: z.number().int().positive().nullable().optional(),
  activo: z.boolean().default(true),
  vigenciaDesde: z.coerce.date().nullable().optional(),
  vigenciaHasta: z.coerce.date().nullable().optional(),
});
export const cuponInput = cuponBase;
export const cuponUpdate = partialSinDefaults(cuponBase.shape);

export const cuponValidar = z.object({
  codigo: z.string().trim().min(1, 'Ingresá el código').max(30),
  subtotal: z.number().nonnegative().default(0),
});

// ---------- Newsletter / avisos / contacto ----------
export const newsletterInput = z.object({
  email: emailSchema,
  origen: nullableStr(40),
});

export const avisoStockInput = z.object({
  email: emailSchema,
  varianteId: z.string().min(1),
});

export const MOTIVOS_CONTACTO = [
  'CONSULTA',
  'TURNO',
  'CAMBIO',
  'ARREPENTIMIENTO',
  'OPTICA',
  'OTRO',
] as const;
export const contactoInput = z.object({
  nombre: z.string().trim().min(2, 'Ingresá tu nombre').max(120),
  email: emailSchema,
  telefono: nullableStr(40),
  motivo: z.enum(MOTIVOS_CONTACTO).default('CONSULTA'),
  mensaje: z.string().trim().min(5, 'Contanos un poco más').max(3000),
  pedido: nullableStr(40),
  // Honeypot anti-spam: si viene con contenido, se ignora silenciosamente.
  web: z.string().max(200).optional(),
});

export const contactoListQuery = z.object({
  motivo: z.enum(MOTIVOS_CONTACTO).optional(),
  leido: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(120).optional(),
});

// ---------- Búsqueda ----------
export const sugerenciasQuery = z.object({
  q: z.string().trim().min(1).max(80),
});

export const slugsQuery = z.object({
  slugs: csvList.pipe(z.array(z.string().max(120)).max(24)),
});

// ---------- Carrito sincronizado ----------
export const carritoItem = z
  .object({
    varianteId: z.string().min(1),
    cantidad: z.number().int().min(1).max(10),
    conReceta: z.boolean().optional(),
  })
  .loose();
export const carritoInput = z.object({
  items: z.array(carritoItem).max(50),
  cupon: z.string().trim().max(30).nullable().optional(),
});
