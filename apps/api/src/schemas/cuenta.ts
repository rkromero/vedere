// Esquemas Zod de la cuenta del cliente (prompt 6): recuperación de contraseña, datos personales,
// direcciones guardadas y login con Google.
import { z } from 'zod';
import { direccionInput } from './checkout.js';

export const emailCuenta = z
  .string({ error: 'Ingresá un email válido' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Ingresá un email válido' }));

export const passwordCuenta = z
  .string({ error: 'Ingresá una contraseña' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

const telefono = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s()-]{5,24}$/, 'Teléfono inválido');

/** Código de referido tal como viene del link /r/<codigo> (se normaliza a mayúsculas). */
export const codigoReferidoInput = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,12}$/, 'Código de referido inválido');

export const recuperarInput = z.object({ email: emailCuenta });

export const restablecerInput = z.object({
  token: z.string().trim().min(20, 'Token inválido').max(200),
  password: passwordCuenta,
});

export const datosInput = z.object({
  nombre: z.string().trim().min(2, 'Ingresá tu nombre').max(120),
  telefono: telefono.nullable().optional(),
  newsletter: z.boolean().optional(),
});

export const cambioPasswordInput = z.object({
  actual: z.string().max(128).optional(),
  nueva: passwordCuenta,
});

/** Dirección guardada: mismas reglas que la del checkout más etiqueta, teléfono y predeterminada. */
export const direccionCuentaInput = direccionInput.omit({ direccionCompleta: true }).extend({
  etiqueta: z.string().trim().min(1, 'Poné un nombre a la dirección').max(40).default('Casa'),
  telefono: telefono.nullable().optional(),
  predeterminada: z.boolean().optional(),
});

export const googleStartQuery = z.object({
  next: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/(?!\/)/, 'Destino inválido')
    .default('/mi-cuenta'),
  ref: codigoReferidoInput.optional(),
});

export const googleCallbackQuery = z.object({
  code: z.string().min(1).max(2000).optional(),
  state: z.string().min(1).max(500).optional(),
  error: z.string().max(200).optional(),
});

/** B2B 4: calificación del cliente a un pedido entregado. */
export const calificacionInput = z.object({
  puntaje: z.number({ error: 'Elegí de 1 a 5 estrellas' }).int().min(1, 'Elegí de 1 a 5 estrellas').max(5, 'Elegí de 1 a 5 estrellas'),
  comentario: z.string().trim().max(500).nullable().optional(),
});
