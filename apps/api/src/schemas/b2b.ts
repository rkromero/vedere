// Esquemas Zod del canal mayorista (B2B 1): solicitud de alta de ópticas, resolución en el backoffice y
// usuarios del equipo de cada óptica.
import { z } from 'zod';
import { MENSAJE_CUIT, errorCuit, formatearCuit } from '../lib/cuit.js';

export const CONDICIONES_IVA = ['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO'] as const;
export const ESTADOS_SOLICITUD_OPTICA = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;

const emailSchema = z
  .string({ error: 'Ingresá un email válido' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Ingresá un email válido' }));
const telefono = (msg: string) =>
  z
    .string({ error: msg })
    .trim()
    .regex(/^[+\d][\d\s()-]{5,24}$/, msg);
const texto = (min: number, max: number, msg: string) => z.string({ error: msg }).trim().min(min, msg).max(max);

/** CUIT con formato y dígito verificador; se guarda como "30-71234567-1". */
export const cuitSchema = z
  .string({ error: 'Ingresá el CUIT' })
  .trim()
  .superRefine((v, ctx) => {
    const e = errorCuit(v);
    if (e) ctx.addIssue({ code: 'custom', message: MENSAJE_CUIT[e] });
  })
  .transform(formatearCuit);

export const solicitudOpticaInput = z.object({
  razonSocial: texto(2, 160, 'Ingresá la razón social'),
  nombreComercial: texto(2, 120, 'Ingresá el nombre comercial'),
  cuit: cuitSchema,
  condicionIva: z.enum(CONDICIONES_IVA, { error: 'Elegí la condición frente al IVA' }),
  direccion: texto(3, 200, 'Ingresá la dirección'),
  localidad: texto(2, 80, 'Ingresá la localidad'),
  provincia: texto(2, 80, 'Ingresá la provincia'),
  codigoPostal: z
    .string({ error: 'Ingresá el código postal' })
    .trim()
    .regex(/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/, 'Código postal inválido (ej. 1425 o C1425ABC)')
    .transform((v) => v.toUpperCase()),
  telefono: telefono('Ingresá un teléfono válido'),
  whatsapp: z
    .union([telefono('Ingresá un WhatsApp válido'), z.literal('')])
    .nullable()
    .optional()
    .transform((v) => v || null),
  email: emailSchema,
  opticoResponsable: texto(3, 120, 'Ingresá el nombre del óptico responsable'),
  matricula: texto(2, 40, 'Ingresá la matrícula'),
  /** URL devuelta por POST /sitio/opticas/habilitacion. */
  habilitacionUrl: z
    .string({ error: 'Adjuntá la habilitación' })
    .trim()
    .min(1, 'Adjuntá la habilitación')
    .max(500)
    .refine((v) => v.includes('/opticas-habilitaciones/'), 'Adjuntá la habilitación desde el formulario'),
  habilitacionNombre: z.string().trim().max(200).nullable().optional(),
  aceptaTerminos: z.literal(true, { error: 'Tenés que aceptar los términos del programa' }),
  // Honeypot anti-spam.
  web: z.string().max(200).optional(),
});

export const solicitudesOpticaQuery = z.object({
  estado: z.enum(ESTADOS_SOLICITUD_OPTICA).optional(),
  q: z.string().trim().max(120).optional(),
});

export const aprobarSolicitudOpticaInput = z.object({
  /** Vincular a una óptica existente en vez de crear una nueva (si no viene, se busca por CUIT). */
  opticaId: z.string().min(1).nullable().optional(),
  comisionPct: z.number().min(0).max(100).optional(),
  radioKm: z.number().min(0.5).max(500).optional(),
  capacidadDiaria: z.number().int().min(0).max(1000).optional(),
  nota: z.string().trim().max(500).optional(),
});

export const rechazarSolicitudOpticaInput = z.object({
  motivo: z.string({ error: 'Indicá el motivo' }).trim().min(5, 'Indicá el motivo (mínimo 5 caracteres)').max(1000),
});

export const usuarioOpticaInput = z.object({
  nombre: z.string({ error: 'Ingresá el nombre' }).trim().min(2, 'Ingresá el nombre').max(120),
  email: emailSchema,
  telefono: z
    .union([telefono('Teléfono inválido'), z.literal('')])
    .nullable()
    .optional()
    .transform((v) => v || null),
});

export const cambiarPasswordInput = z.object({
  actual: z.string().min(1, 'Ingresá tu contraseña actual').max(128),
  nueva: z.string().min(8, 'La contraseña nueva debe tener al menos 8 caracteres').max(128),
});
