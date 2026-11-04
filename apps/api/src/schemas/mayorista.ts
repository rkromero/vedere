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

export const ESTADOS_MAYORISTA = [
  'PENDIENTE_APROBACION',
  'EN_REVISION',
  'APROBADO',
  'EN_PREPARACION',
  'LISTO_PARA_RETIRO',
  'DESPACHADO',
  'ENTREGADO',
  'CANCELADO',
] as const;

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');
/** AAAA-MM-DD → mediodía de Argentina (evita corrimientos de día por zona horaria). */
export const aFechaLocal = (s: string) => new Date(`${s}T12:00:00-03:00`);

export const pedidosMayoristasQuery = z.object({
  estado: z.enum(ESTADOS_MAYORISTA).optional(),
  q: z.string().trim().max(80).optional(),
  opticaId: z.string().max(40).optional(),
  entrega: z.enum(['ENVIO_TRANSPORTE', 'RETIRO_DEPOSITO']).optional(),
  desde: fechaIso.optional(),
  hasta: fechaIso.optional(),
  estadoPago: z.enum(['IMPAGO', 'PARCIAL', 'PAGADO', 'VENCIDO']).optional(),
});

export const cancelarMayoristaInput = z.object({
  motivo: z.string().trim().min(3, 'Contá por qué se cancela').max(500),
});

export const notaTransicionInput = z.object({
  nota: z.string().trim().max(1000).nullable().optional(),
});

const urlOpcional = z
  .union([z.url('Link inválido (tiene que empezar con http:// o https://)').max(500), z.literal('')])
  .nullable()
  .optional();

export const despacharMayoristaInput = z.object({
  transporte: z.string().trim().min(2, 'Indicá el transporte').max(120),
  numeroSeguimiento: z.string().trim().max(80).nullable().optional(),
  linkSeguimiento: urlOpcional,
  nota: z.string().trim().max(1000).nullable().optional(),
});

export const actualizarPedidoMayoristaInput = z.object({
  notasInternas: z.string().trim().max(4000).nullable().optional(),
  numeroFactura: z.string().trim().max(60).nullable().optional(),
  nota: z.string().trim().max(1000).nullable().optional(),
  notaInterna: z.boolean().optional(),
});

export const devolucionMayoristaInput = z.object({
  motivo: z.string().trim().min(5, 'Contá el motivo de la devolución').max(1000),
  fotos: z.array(z.url().max(500)).max(6, 'Hasta 6 fotos').default([]),
  items: z
    .array(z.object({ itemId: z.string().min(1).max(40), cantidad: z.number().int().min(0).max(9999) }))
    .min(1, 'Elegí qué modelos devolvés')
    .max(200),
});

export const motivoInput = z.object({
  motivo: z.string().trim().min(3, 'Indicá el motivo').max(500),
});

export const devolucionesQuery = z.object({
  estado: z.enum(['SOLICITADA', 'APROBADA', 'RECHAZADA']).optional(),
  opticaId: z.string().max(40).optional(),
});

// ---------- Cuenta corriente ----------

const MEDIOS = ['TRANSFERENCIA', 'ECHEQ', 'EFECTIVO'] as const;
const importe = z.number({ error: 'Ingresá un importe' }).positive('El importe tiene que ser mayor a 0').max(1_000_000_000);
const imputaciones = z
  .array(z.object({ pedidoId: z.string().min(1).max(40), monto: z.number().positive().max(1_000_000_000) }))
  .max(200)
  .optional();

export const pagoCuentaInput = z.object({
  importe,
  medio: z.enum(MEDIOS, { error: 'Elegí el medio de pago' }),
  fecha: fechaIso.nullable().optional(),
  referencia: z.string().trim().max(120).nullable().optional(),
  comprobanteUrl: z.url().max(500).nullable().optional(),
  notas: z.string().trim().max(500).nullable().optional(),
  imputaciones,
});

export const ajusteCuentaInput = z.object({
  importe: z
    .number({ error: 'Ingresá un importe' })
    .min(-1_000_000_000)
    .max(1_000_000_000)
    .refine((n) => Math.abs(n) >= 0.01, 'El importe no puede ser 0'),
  motivo: z.string().trim().min(5, 'El ajuste necesita un motivo').max(500),
});

export const pagoInformadoInput = z.object({
  importe,
  medio: z.enum(MEDIOS, { error: 'Elegí el medio de pago' }),
  fechaPago: fechaIso,
  referencia: z.string().trim().max(120).nullable().optional(),
  comprobanteUrl: z.url('Subí el comprobante').max(500),
  comprobanteNombre: z.string().trim().max(200).nullable().optional(),
  notas: z.string().trim().max(500).nullable().optional(),
  pedidoIds: z.array(z.string().min(1).max(40)).max(100).optional(),
});

export const validarPagoInformadoInput = z.object({ imputaciones });

export const movimientosQuery = z.object({
  tipo: z.enum(['DEBITO_PEDIDO', 'PAGO', 'NOTA_CREDITO', 'CREDITO_LIQUIDACION', 'AJUSTE']).optional(),
});

export const pagosInformadosQuery = z.object({
  estado: z.enum(['PENDIENTE', 'VALIDADO', 'RECHAZADO']).optional(),
  opticaId: z.string().max(40).optional(),
});

export const cerrarLiquidacionInput = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido (AAAA-MM)'),
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
    diasToleranciaVencida: z.number().int().min(0).max(365).default(7),
  })
  .refine((c) => c.envioHabilitado || c.retiroHabilitado, {
    message: 'Tiene que haber al menos una forma de entrega',
    path: ['retiroHabilitado'],
  })
  .refine((c) => !c.retiroHabilitado || !!c.retiroDireccion, {
    message: 'Cargá la dirección del depósito para el retiro',
    path: ['retiroDireccion'],
  });
