// Esquemas Zod del prompt 6: sitio público (arrepentimiento, newsletter, redirecciones), plantillas de email,
// páginas legales, arrepentimientos y newsletter en el admin, reportes.
import { z } from 'zod';
import { paginationQuery } from '../lib/pagination.js';

const nullableStr = (max: number) => z.string().trim().max(max).nullable().optional();
const emailSchema = z
  .string({ error: 'Ingresá un email válido' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Ingresá un email válido' }));

// ---------- Público ----------
export const arrepentimientoInput = z.object({
  nombre: z.string().trim().min(2, 'Ingresá tu nombre y apellido').max(120),
  email: emailSchema,
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'DNI inválido (7 u 8 números)')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  telefono: nullableStr(30),
  pedidoNumero: nullableStr(30),
  motivo: nullableStr(1000),
  // Honeypot anti-spam.
  web: z.string().max(200).optional(),
});

export const arrepentimientoConsultaQuery = z.object({ email: emailSchema });

export const newsletterAltaInput = z.object({
  email: emailSchema,
  nombre: nullableStr(120),
  origen: nullableStr(40),
});

export const redireccionHitInput = z.object({ origen: z.string().trim().min(1).max(500) });

// ---------- Admin: plantillas de email ----------
export const plantillaUpdate = z.object({
  asunto: z.string().trim().min(3, 'Ingresá el asunto').max(200),
  titulo: z.string().trim().min(2, 'Ingresá el título').max(200),
  cuerpo: z.string().trim().min(5, 'Ingresá el texto del email').max(5000),
  ctaLabel: nullableStr(80),
  activa: z.boolean().optional(),
});

export const plantillaPreview = plantillaUpdate.partial();

export const plantillaPruebaInput = z.object({ para: emailSchema });

// ---------- Admin: páginas legales ----------
export const PAGINAS_SLUGS = ['terminos', 'privacidad', 'cambios', 'cookies', 'programa-opticas'] as const;
export const paginaLegalUpdate = z.object({
  titulo: z.string().trim().min(2, 'Ingresá el título').max(160),
  intro: nullableStr(400),
  contenido: z.string().trim().min(10, 'Ingresá el contenido').max(60000),
  publicada: z.boolean().optional(),
});

// ---------- Admin: redirecciones ----------
const rutaOrigen = z
  .string()
  .trim()
  .min(2, 'La ruta de origen empieza con /')
  .max(500)
  .regex(/^\/[^\s?#]*$/, 'La ruta de origen empieza con / y no lleva query string')
  .transform((v) => (v.length > 1 ? v.replace(/\/+$/, '') : v));
const destino = z
  .string()
  .trim()
  .min(1, 'Ingresá el destino')
  .max(1000)
  .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), 'El destino es una ruta (/sol) o una URL completa');

export const redireccionInput = z
  .object({
    origen: rutaOrigen,
    destino,
    permanente: z.boolean().default(true),
    activa: z.boolean().default(true),
  })
  .refine((v) => v.origen !== v.destino, { path: ['destino'], message: 'El destino no puede ser igual al origen' });

export const redireccionUpdate = z
  .object({
    origen: rutaOrigen.optional(),
    destino: destino.optional(),
    permanente: z.boolean().optional(),
    activa: z.boolean().optional(),
  })
  .refine((v) => !v.origen || !v.destino || v.origen !== v.destino, { path: ['destino'], message: 'El destino no puede ser igual al origen' });

// ---------- Admin: arrepentimientos ----------
export const ESTADOS_ARREPENTIMIENTO = ['RECIBIDO', 'EN_PROCESO', 'RESUELTO', 'RECHAZADO'] as const;
export const arrepentimientosQuery = paginationQuery.extend({
  estado: z.enum(ESTADOS_ARREPENTIMIENTO).optional(),
  q: z.string().trim().max(120).optional(),
});
export const arrepentimientoUpdate = z.object({
  estado: z.enum(ESTADOS_ARREPENTIMIENTO),
  respuesta: nullableStr(2000),
});

// ---------- Admin: newsletter ----------
export const newsletterAdminQuery = paginationQuery.extend({
  q: z.string().trim().max(120).optional(),
  estado: z.enum(['activos', 'bajas']).optional(),
});

// ---------- Admin: reportes ----------
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD');
export const reportesQuery = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
});
export const reportesCsvQuery = reportesQuery.extend({
  tipo: z.enum(['pedidos', 'items']).default('pedidos'),
});
