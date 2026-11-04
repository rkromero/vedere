import { z } from 'zod';
import { FORMAS, LINEAS } from './catalogo.js';

const lista = <T extends readonly [string, ...string[]]>(valores: T) =>
  z
    .union([z.enum(valores), z.array(z.enum(valores)), z.string()])
    .transform((v) => (Array.isArray(v) ? v : String(v).split(',')).map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.enum(valores)));

const strs = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean).slice(0, 20));

export const catalogoMayoristaQuery = z.object({
  q: z.string().trim().max(120).optional(), // nombre, marca o SKU
  categoria: z.string().trim().max(120).optional(),
  linea: lista(LINEAS).optional(),
  forma: lista(FORMAS).optional(),
  color: strs.optional(),
  marca: z.string().trim().max(120).optional(),
  coleccion: z.string().trim().max(120).optional(),
  soloConStock: z.enum(['true', 'false']).optional(),
  orden: z.enum(['nombre', 'novedades', 'precio_asc', 'precio_desc']).default('nombre'),
});

const itemCarrito = z.object({
  varianteId: z.string().min(1).max(40),
  cantidad: z.number().int('La cantidad tiene que ser un número entero').min(0).max(9999),
});

export const carritoMayoristaInput = z.object({
  items: z.array(itemCarrito).max(500),
  /** sumar: agrega a lo que ya hay (catálogo). reemplazar: deja el carrito exactamente así (pantalla del carrito). */
  modo: z.enum(['sumar', 'reemplazar']).default('sumar'),
});

export const confirmarMayoristaInput = z.object({
  entrega: z.enum(['ENVIO_TRANSPORTE', 'RETIRO_DEPOSITO'], { error: 'Elegí cómo recibir el pedido' }),
  notas: z.string().trim().max(1000).nullable().optional(),
  repetidoDeId: z.string().max(40).nullable().optional(),
});

export const pedidosMayoristasQuery = z.object({
  estado: z.enum(['PENDIENTE_APROBACION', 'APROBADO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO']).optional(),
  q: z.string().trim().max(80).optional(),
  opticaId: z.string().max(40).optional(),
});

export const cancelarMayoristaInput = z.object({
  motivo: z.string().trim().min(3, 'Contá por qué se cancela').max(500),
});

export const despacharMayoristaInput = z.object({
  numeroSeguimiento: z.string().trim().max(80).nullable().optional(),
});

export const configMayoristaInput = z
  .object({
    ivaPct: z.number().min(0).max(50),
    minimoTipo: z.enum(['NINGUNO', 'UNIDADES', 'MONTO']),
    minimoValor: z.number().min(0).max(100_000_000),
    envioHabilitado: z.boolean(),
    envioModo: z.enum(['COSTO_FIJO', 'A_CARGO_OPTICA']),
    envioCosto: z.number().min(0).max(100_000_000),
    retiroHabilitado: z.boolean(),
    retiroDireccion: z.string().trim().max(200).nullable().optional(),
    retiroHorario: z.string().trim().max(200).nullable().optional(),
  })
  .refine((c) => c.envioHabilitado || c.retiroHabilitado, {
    message: 'Tiene que haber al menos una forma de entrega',
    path: ['retiroHabilitado'],
  })
  .refine((c) => !c.retiroHabilitado || !!c.retiroDireccion, {
    message: 'Cargá la dirección del depósito para el retiro',
    path: ['retiroDireccion'],
  });
